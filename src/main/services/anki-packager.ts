import Database from 'better-sqlite3'
import { createWriteStream, readFileSync, renameSync } from 'fs'
import { join, basename } from 'path'
import archiver from 'archiver'
import { v4 as uuid } from 'uuid'
import type { SelectedSentence } from '../../shared/types'
import type { MediaFiles } from './media-extract'
import { logger } from '../utils/logger'

const MODEL_ID = 1704000000000
const DECK_ID = 1704000000001
const CSS = `
.card { font-family: -apple-system, BlinkMacSystemFont, sans-serif; text-align: center; padding: 20px; }
.card img { max-width: 100%; max-height: 300px; border-radius: 8px; margin-bottom: 16px; }
.sentence { font-size: 1.4em; margin: 12px 0; font-weight: 500; }
.translation { font-size: 1.1em; color: #555; margin: 8px 0; }
.source { font-size: 0.8em; color: #999; margin-top: 16px; }
`

const FRONT_TEMPLATE = `<div class="card">
<img src="{{Image}}">
[sound:{{Audio}}]
</div>`

const BACK_TEMPLATE = `<div class="card">
<img src="{{Image}}">
[sound:{{Audio}}]
<div class="sentence">{{Sentence}}</div>
<div class="translation">{{Translation}}</div>
<div class="source">{{Source}}</div>
</div>`

export async function buildApkg(
  sentences: SelectedSentence[],
  mediaMap: Map<number, MediaFiles>,
  tempDir: string,
  sourceUrl: string
): Promise<string> {
  const colPath = join(tempDir, 'collection.anki2')
  const apkgPath = join(tempDir, 'output.apkg')
  const now = Math.floor(Date.now() / 1000)

  logger.info(`Building .apkg with ${sentences.length} cards...`)

  // Build collection.anki2 SQLite
  const db = new Database(colPath)
  db.pragma('journal_mode = DELETE')

  db.exec(`
    CREATE TABLE col (
      id INTEGER PRIMARY KEY,
      crt INTEGER NOT NULL,
      mod INTEGER NOT NULL,
      scm INTEGER NOT NULL,
      ver INTEGER NOT NULL DEFAULT 11,
      dty INTEGER NOT NULL DEFAULT 0,
      usn INTEGER NOT NULL DEFAULT -1,
      ls INTEGER NOT NULL DEFAULT 0,
      conf TEXT NOT NULL,
      models TEXT NOT NULL,
      decks TEXT NOT NULL,
      dconf TEXT NOT NULL,
      tags TEXT NOT NULL DEFAULT '{}'
    );
    CREATE TABLE notes (
      id INTEGER PRIMARY KEY,
      guid TEXT NOT NULL,
      mid INTEGER NOT NULL,
      mod INTEGER NOT NULL,
      usn INTEGER NOT NULL DEFAULT -1,
      tags TEXT NOT NULL DEFAULT '',
      flds TEXT NOT NULL,
      sfld TEXT NOT NULL,
      csum INTEGER NOT NULL DEFAULT 0,
      flags INTEGER NOT NULL DEFAULT 0,
      data TEXT NOT NULL DEFAULT ''
    );
    CREATE TABLE cards (
      id INTEGER PRIMARY KEY,
      nid INTEGER NOT NULL,
      did INTEGER NOT NULL,
      ord INTEGER NOT NULL DEFAULT 0,
      mod INTEGER NOT NULL,
      usn INTEGER NOT NULL DEFAULT -1,
      type INTEGER NOT NULL DEFAULT 0,
      queue INTEGER NOT NULL DEFAULT 0,
      due INTEGER NOT NULL,
      ivl INTEGER NOT NULL DEFAULT 0,
      factor INTEGER NOT NULL DEFAULT 2500,
      reps INTEGER NOT NULL DEFAULT 0,
      lapses INTEGER NOT NULL DEFAULT 0,
      left INTEGER NOT NULL DEFAULT 0,
      odue INTEGER NOT NULL DEFAULT 0,
      odid INTEGER NOT NULL DEFAULT 0,
      flags INTEGER NOT NULL DEFAULT 0,
      data TEXT NOT NULL DEFAULT ''
    );
    CREATE TABLE revlog (
      id INTEGER PRIMARY KEY,
      cid INTEGER NOT NULL,
      usn INTEGER NOT NULL DEFAULT -1,
      ease INTEGER NOT NULL,
      ivl INTEGER NOT NULL,
      lastIvl INTEGER NOT NULL,
      factor INTEGER NOT NULL,
      time INTEGER NOT NULL,
      type INTEGER NOT NULL
    );
    CREATE TABLE graves (
      usn INTEGER NOT NULL,
      oid INTEGER NOT NULL,
      type INTEGER NOT NULL
    );
  `)

  const model = {
    [MODEL_ID]: {
      id: MODEL_ID,
      name: 'Sentence Extraction',
      type: 0,
      mod: now,
      usn: -1,
      sortf: 0,
      did: DECK_ID,
      tmpls: [
        {
          name: 'Card 1',
          ord: 0,
          qfmt: FRONT_TEMPLATE,
          afmt: BACK_TEMPLATE,
          bqfmt: '',
          bafmt: '',
          did: null,
          bfont: '',
          bsize: 0
        }
      ],
      flds: [
        { name: 'Sentence', ord: 0, sticky: false, rtl: false, font: 'Arial', size: 20, media: [] },
        { name: 'Translation', ord: 1, sticky: false, rtl: false, font: 'Arial', size: 20, media: [] },
        { name: 'Audio', ord: 2, sticky: false, rtl: false, font: 'Arial', size: 20, media: [] },
        { name: 'Image', ord: 3, sticky: false, rtl: false, font: 'Arial', size: 20, media: [] },
        { name: 'Source', ord: 4, sticky: false, rtl: false, font: 'Arial', size: 20, media: [] }
      ],
      css: CSS,
      latexPre: '',
      latexPost: '',
      latexsvg: false,
      req: [[0, 'any', [0]]]
    }
  }

  const deck = {
    [DECK_ID]: {
      id: DECK_ID,
      name: 'Sentence Extraction',
      mod: now,
      usn: -1,
      lrnToday: [0, 0],
      revToday: [0, 0],
      newToday: [0, 0],
      timeToday: [0, 0],
      collapsed: false,
      browserCollapsed: false,
      desc: '',
      dyn: 0,
      conf: 1,
      extendNew: 0,
      extendRev: 0
    }
  }

  const conf = JSON.stringify({
    activeDecks: [1],
    curDeck: 1,
    newSpread: 0,
    collapseTime: 1200,
    timeLim: 0,
    estTimes: true,
    dueCounts: true,
    curModel: MODEL_ID,
    nextPos: 1,
    sortType: 'noteFld',
    sortBackwards: false,
    addToCur: true
  })

  const dconf = JSON.stringify({
    1: {
      id: 1,
      name: 'Default',
      replayq: true,
      lapse: { delays: [10], mult: 0, minInt: 1, leechFails: 8, leechAction: 0 },
      rev: { perDay: 200, ease4: 1.3, ivlFct: 1, maxIvl: 36500, fuzz: 0.05, minSpace: 1 },
      new: { delays: [1, 10], ints: [1, 4, 0], initialFactor: 2500, order: 1, perDay: 20 },
      maxTaken: 60,
      timer: 0,
      autoplay: true,
      mod: 0,
      usn: 0
    }
  })

  db.prepare(
    'INSERT INTO col VALUES (1, ?, ?, ?, 11, 0, -1, 0, ?, ?, ?, ?, ?)'
  ).run(now, now, now * 1000, conf, JSON.stringify(model), JSON.stringify(deck), dconf, '{}')

  const insertNote = db.prepare(
    'INSERT INTO notes (id, guid, mid, mod, usn, tags, flds, sfld, csum, flags, data) VALUES (?, ?, ?, ?, -1, \'\', ?, ?, 0, 0, \'\')'
  )
  const insertCard = db.prepare(
    'INSERT INTO cards (id, nid, did, ord, mod, usn, type, queue, due, ivl, factor, reps, lapses, left, odue, odid, flags, data) VALUES (?, ?, ?, 0, ?, -1, 0, 0, ?, 0, 2500, 0, 0, 0, 0, 0, 0, \'\')'
  )

  // Media mapping: index → filename in zip
  const mediaEntries: Record<string, string> = {}
  let mediaIdx = 0

  const insertAll = db.transaction(() => {
    for (let i = 0; i < sentences.length; i++) {
      const s = sentences[i]
      const media = mediaMap.get(s.index)
      if (!media) continue

      const audioName = basename(media.audioPath)
      const imageName = basename(media.imagePath)

      // Map to numeric media names for Anki
      const audioMediaName = String(mediaIdx++)
      const imageMediaName = String(mediaIdx++)
      mediaEntries[audioMediaName] = media.audioPath
      mediaEntries[imageMediaName] = media.imagePath

      const noteId = now * 1000 + i
      const cardId = noteId + 1000000
      const flds = [s.text, s.translation, audioMediaName, imageMediaName, sourceUrl].join('\x1f')

      insertNote.run(noteId, uuid().replace(/-/g, '').slice(0, 10), MODEL_ID, now, flds, s.text)
      insertCard.run(cardId, noteId, DECK_ID, now, i)
    }
  })
  insertAll()
  db.close()

  // Build zip
  await new Promise<void>((resolve, reject) => {
    const output = createWriteStream(apkgPath)
    const archive = archiver('zip', { store: true })
    archive.pipe(output)

    archive.file(colPath, { name: 'collection.anki2' })

    // Add media files with numeric names
    const mediaJson: Record<string, string> = {}
    for (const [numName, filePath] of Object.entries(mediaEntries)) {
      archive.file(filePath, { name: numName })
      mediaJson[numName] = basename(filePath)
    }
    archive.append(JSON.stringify(mediaJson), { name: 'media' })

    output.on('close', resolve)
    archive.on('error', reject)
    archive.finalize()
  })

  logger.info(`Built .apkg at ${apkgPath}`)
  return apkgPath
}
