const {Telegraf} = require('telegraf');
const {MenuTemplate, MenuMiddleware} = require('telegraf-inline-menu');
const session = require('telegraf/session');
const axios = require('axios');
const {exec} = require("child_process");
require('dotenv').config();

const telegram_token = process.env.TELEGRAM_BOT
const telegram_allowed_users_ids = process.env.TELEGRAM_UIDS
const joplin_token = process.env.JOPLIN_TOKEN
const base_url = process.env.JOPLIN_URL

const bot = new Telegraf(telegram_token)
bot.use(session())


function sync() {
  exec("joplin --profile ~/.config/joplin/ sync", (error, stdout, stderr) => {
    if (error) {
      console.log(`error: ${error.message}`);
      return;
    }
    if (stderr) {
      console.log(`stderr: ${stderr}`);
      return;
    }
    console.log(`stdout: ${stdout}`);
  });
}

function makeUrl(endpoint, args) {
  if (!args)
    args = []
  if (!Array.isArray(args))
    args = Object.keys(args).map((key) => key + "=" + args[key])
  const arg = args.length > 0 ? ("&" + args.join("&")) : ''
  return base_url + endpoint + "?token=" + joplin_token + arg
}
async function fetchJson(endpoint, args) {
  const url = makeUrl(endpoint, args)
  const response = await axios.get(url)
  return response.data
}

async function fetchAll(endpoint, args = []) {
  let pageNum = 1;
  let items = [];

  let response = {}
  do {
    response = await fetchJson(endpoint, ["page=" + pageNum++, ...args]);
    items.push(...response.items)
  } while (response.has_more)
  return items
}

async function post(endpoint, data) {
  return await axios.post(makeUrl(endpoint), data).data
}

commands = {
  sync: ctx => {
    sync()
    ctx.reply("Data synced!")
  },
  menu: ctx => menuMiddleware.replyToContext(ctx)
}

const menu = new MenuTemplate(() => 'Main Menu\n' + new Date().toISOString())
menu.interact('I am excited!', 'a', {
  do: async (ctx) => {
    ctx.reply('As am I!')
    return false
  }
}
)
const menuMiddleware = new MenuMiddleware('/', menu)

Object.keys(commands).map(cmd => bot.command(cmd, ctx => {
  from_id = ctx.message.from.id
  if (!telegram_allowed_users_ids.includes(from_id)) {
    ctx.reply(`You are not allowed to use this bot! Maybe you forgot to add your used id to .env? (${from_id})`)
    return
  }
  commands[cmd](ctx)
}))

bot.start(async (ctx) => {
  await ctx.setMyCommands([{command: "folders", description: "List all folders"}])
  ctx.reply('Welcome to your Joplin notebook!, just type /help for available commands 😊')
})
bot.help((ctx) => ctx.reply('Use /notes to gel all your notes, or send a message to create a note...'))
bot.command('notes', async ctx => {
  let notes = await fetchAll("notes")
  if (notes.length == 0) {
    ctx.reply("You have no notes yet!")
    return
  }
  ctx.reply(notes.map(p => p.title).join('\n'))
})
bot.command('folders', async ctx => {
  // TODO show tree properly
  let folders = await fetchAll("folders")
  if (folders.length == 0) {
    ctx.reply("You have no folders yet!")
    return
  }
  ctx.reply(folders.map(p => p.title).join('\n'))
})
bot.command('newfolder', async ctx => {
  ctx.session.newfolder = true
  ctx.reply("Tell me the name for the folder")
})
bot.on('text', async ctx => {
  if (ctx.session?.newfolder) {
    ctx.reply(`Adding  ${ctx.message.text}`)
    post("folders", {title: ctx.message.text})
    ctx.session.newfolder = false
  }
  if (ctx.session?.addnote) {
    let note = new Note(ctx.message.text.slice(0, 25), ctx.message.text)
    try {
      await axios.post(base_url, note)
      ctx.reply('You created a new text note successfully!')
    } catch {
      ctx.reply("Some error occurred 😭")
    }
    ctx.session.addnote = false
  }
})
bot.on('photo', async ctx => {
  let caption = ctx.message.caption ? ctx.message.caption : 'No title'
  let note = new Note(caption, caption, ctx.message.photo)
  await note.setImageData(ctx)
  await axios.post(base_url, note);
  ctx.reply('You created a new image note successfully!')
})

bot.use(menuMiddleware)
bot.launch()
// Enable graceful stop
process.once('SIGINT', () => bot.stop('SIGINT'))
process.once('SIGTERM', () => bot.stop('SIGTERM'))

class Note {
  constructor(title, body) {
    this.title = title
    this.body = body
    this.image_data_url = null
  }

  async setImageData(ctx) {
    if (ctx.message.photo) {
      // get largest possible
      let largest = ctx.message.photo.reduce((prev, current) => (+prev.width > +current.width) ? prev : current)
      let image_url = await ctx.telegram.getFileLink(largest.file_id)
      let image_result = await axios.get(image_url, {responseType: 'arraybuffer'});
      this.image_data_url = "data:image/png;base64," + Buffer.from(image_result.data).toString('base64');
    }
  }
}

class Folder {
  constructor(title) {
    this.title = title
    this.parent_id = 0
  }
}
