import { basename } from 'path'
import vscode = require('vscode')
import moment = require('moment')

import {
  ExtensionContext, TextEdit, TextEditorEdit, TextDocument, Position, Range
} from 'vscode'

import {
  extractHeader, getHeaderInfo, renderHeader,
  supportsLanguage, HeaderInfo
} from './header'

var isConvertState:boolean = false

/**
 * Return current user from config or ENV by default
 */
const getCurrentUser = () =>
  vscode.workspace.getConfiguration()
    .get('codamheader.CodamUsername') || process.env['USER'] || 'anonymous'

/**
 * Return current user mail from config or default value
 */
const getCurrentUserMail = () =>
  vscode.workspace.getConfiguration()
    .get('codamheader.CodamEmail') || `${getCurrentUser()}@student.codam.nl`

/**
 * Return setting for changing the By: (username) <(email)> line.
 */
const getChangeName= () =>
  vscode.workspace.getConfiguration()
	.get('codamheader.ChangeAuthor')

/**
 * Return setting for changing the By: (username) <(email)> line.
 */
const getUpdateTime= () =>
  vscode.workspace.getConfiguration()
  .get('codamheader.UpdateTime')

/**
 * Update HeaderInfo with last update author and date, and update filename
 * Returns a fresh new HeaderInfo if none was passed
 */
const newHeaderInfo = (document: TextDocument, headerInfo?: HeaderInfo) => {
  const user = getCurrentUser()
  const mail = getCurrentUserMail()
  const setby = getChangeName()
  const updateTime = getUpdateTime()
  
  if (setby)
    return Object.assign({},
      // This will be overwritten if headerInfo is not null
      {
      createdAt: moment(),
      createdBy: user
      },
      headerInfo,
      {
      filename: basename(document.fileName),
      author: `${user} <${mail}>`,
      updatedBy: user,
      updatedAt: moment()
      }
    )
  else
    if (updateTime)
      return Object.assign({},
        // This will be overwritten if headerInfo is not null
        {
        createdAt: moment(),
        createdBy: user,
        author: `${user} <${mail}>`
        },
        headerInfo,
        {
		filename: basename(document.fileName),
        updatedBy: user,
        updatedAt: moment()
        }
      )
    else
      return Object.assign({},
        // This will be overwritten if headerInfo is not null
        {
        createdAt: moment(),
        createdBy: user,
        author: `${user} <${mail}>`,
        updatedBy: user,
        updatedAt: moment()
        },
        headerInfo,
        {
        filename: basename(document.fileName)
        }
      )
}

/**
 * `insertHeader` Command Handler
 */
const insertHeaderHandler = () => {
  const { activeTextEditor } = vscode.window
  const { document } = activeTextEditor

  if (supportsLanguage(document.languageId))
    activeTextEditor.edit(editor => {
      const currentHeader = extractHeader(document.getText())

      if (currentHeader)
        editor.replace(
          new Range(0, 0, 12, 0),
          renderHeader(
            document.languageId,
            newHeaderInfo(document, getHeaderInfo(currentHeader))
          )
        )
      else
        editor.insert(
          new Position(0, 0),
          renderHeader(
            document.languageId,
            newHeaderInfo(document)
          )
        )
    })
  else
    vscode.window.showInformationMessage(
      `No header support for language ${document.languageId}`
    )
}

async function asyncForEach(array: Array<vscode.Uri>, callback: { (file: vscode.Uri): Promise<void>; (arg0: vscode.Uri): any }) {
  for (let index = 0; index < array.length; index++) {
    await callback(array[index]);
  }
}

const convertHeadersHandler = async function () {
  const allFiles = await vscode.workspace.findFiles('**/*.{c,h}', '')
  isConvertState = true
  await asyncForEach(allFiles, (async (file: vscode.Uri) => {
    await vscode.workspace.openTextDocument(file).then(async (a: vscode.TextDocument) => {
      await vscode.window.showTextDocument(a, 1, false).then( async e => {
        await e.edit(editor => {
          const currentHeader = extractHeader(a.getText())
    
          if (currentHeader)
            editor.replace(
              new Range(0, 0, 12, 0),
              renderHeader(
                a.languageId,
                getHeaderInfo(currentHeader)
              )    
            )
        }).then( async () => {
          await a.save().then( async () => {
            await vscode.commands.executeCommand("workbench.action.closeActiveEditor");
          })
        })
      })
    })
  })
  )
  isConvertState = false
}
/**
 * Start watcher for document save to update current header
 */
const startUpdateOnSaveWatcher = (subscriptions: vscode.Disposable[]) =>
  vscode.workspace.onWillSaveTextDocument(event => {
    const document = event.document
	const currentHeader = extractHeader(document.getText())
	const isChanged = document.isDirty

    event.waitUntil(
      Promise.resolve(
        supportsLanguage(document.languageId) && currentHeader && isChanged && !isConvertState ?
          [
            TextEdit.replace(
              new Range(0, 0, 12, 0),
              renderHeader(
                document.languageId,
                newHeaderInfo(document, getHeaderInfo(currentHeader))
              )
            )
          ]
          : [] // No TextEdit to apply
      )
    )
  },
    null, subscriptions
  )


export const activate = (context: vscode.ExtensionContext) => {
  const disposable = vscode.commands
    .registerTextEditorCommand('codamheader.insertHeader', insertHeaderHandler)
  const disposable2 = vscode.commands
    .registerCommand('codamheader.convertHeaders', convertHeadersHandler)
  context.subscriptions.push(disposable2)
  context.subscriptions.push(disposable)
  startUpdateOnSaveWatcher(context.subscriptions)
}
