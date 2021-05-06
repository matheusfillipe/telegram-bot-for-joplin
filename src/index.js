const {Telegraf} = require('telegraf');
const {MenuTemplate, MenuMiddleware} = require('telegraf-inline-menu');
const session = require('telegraf/session');
const {Note, Joplin} = require("./joplin")
require('dotenv').config();

const telegram_token = process.env.TELEGRAM_BOT
const telegram_allowed_users_ids = process.env.TELEGRAM_UIDS
const joplin_token = process.env.JOPLIN_TOKEN
const base_url = process.env.JOPLIN_URL

const bot = new Telegraf(telegram_token)
const joplin = new Joplin(base_url, joplin_token)
bot.use(session())

// Defining all Commands and descriptions
const commands = {
  sync: { 
    desc: "Syncronize the notes between devices",
    cb: ctx => {
      joplin.sync()
      ctx.reply("Data synced!")
    }
  },
  notes: { 
    desc: "Displays the notes",
    cb: async (ctx) => {
      let notes = await joplin.fetchAll("notes")
      if (notes.length == 0) {
        ctx.reply("You have no notes yet!")
        return
      }
      ctx.reply(notes.map(p => p.title).join('\n'))
    }
  },
  folders: { 
    desc: "Displays the notebooks/folders",
    cb: async (ctx) => {
      // TODO show tree properly
      let folders = await joplin.fetchAll("folders")
      if (folders.length == 0) {
        ctx.reply("You have no folders yet!")
        return
      }
      ctx.reply(folders.map(p => p.title).join('\n'))
    }
  },
  addfolder: { 
    desc: "Creates a new folder",
    cb: async (ctx) => {
      ctx.session.text_action = async (ctx) => {
        ctx.reply(`Adding  ${ctx.message.text}`)
        await joplin.post("folders", {title: ctx.message.text})
      }
      ctx.reply("Tell me the name for the folder")
    }
  },
  addnote: {
    desc: "Creates a new note",
    cb: ctx => {
      ctx.reply("Tell me the name for the note")
      ctx.session.text_action = async (ctx) => {
        ctx.session.new_note_title = ctx.message.text
        ctx.reply("Tell me what to write on the note")
        ctx.session.text_action = async (ctx) => {
          let note = new Note(ctx.session.new_note_title, ctx.message.text)
          try {
            await joplin.post("notes", note)
            ctx.reply('You created a new text note successfully!')
          } catch {
            ctx.reply("Some error occurred 😭")
          }
        }
      }
    }
  },
  menu: { 
    desc: "Shows a simple menu",
    cb: ctx => {
      menuMiddleware.replyToContext(ctx)
    }
  }
}


// Inline Button Menus
const menu = new MenuTemplate(() => 'Main Menu\n' + new Date().toISOString())
menu.interact('I am excited!', 'a', {
  do: async (ctx) => {
    ctx.reply('As am I!')
    return false
  }
}
)
const menuMiddleware = new MenuMiddleware('/', menu)


// Help and start
const is_valid_uid = ctx => {
  from_id = ctx.message.from.id
  if (!telegram_allowed_users_ids.includes(from_id)) {
    ctx.reply(`You are not allowed to use this bot! Maybe you forgot to add your user id to .env? (${from_id})`)
    return false
  }
  return true
}
const is_async = myFunction => myFunction.constructor.name === "AsyncFunction";
Object.keys(commands).map(cmd => bot.command(cmd, async (ctx) => {
  if (!is_valid_uid(ctx)) return;
  func = commands[cmd].cb
  return is_async(func) ? await func(ctx) : func(ctx)
}))

bot.start(async (ctx) => {
  if (!is_valid_uid(ctx)) return;
  await ctx.setMyCommands(Object.keys(commands).map(cmd => ({command: cmd, description: commands[cmd].desc})))
  ctx.reply('Welcome to your Joplin notebook!, just type /help for available commands 😊')
})

bot.help((ctx) => {
  if (!is_valid_uid(ctx)) return;
  ctx.replyWithMarkdown(Object.keys(commands).reduce((message, cmd) => {
    return message + `${cmd}: ${commands[cmd].desc}\n`
  }, "**Available commands are:**\n\n"))
})


// Message types processing
bot.on('text', async ctx => {
  if (ctx.session?.text_action) {
    const func = ctx.session.text_action
    ctx.session.text_action = false;
    func(ctx)
  }
})

bot.on('photo', async ctx => {
  if (ctx.session?.photo_action) {
    // const func = ctx.session.photo_action
    // let caption = ctx.message.caption ? ctx.message.caption : 'No title'
    // let note = new Note(caption, caption, ctx.message.photo)
    // await note.setImageData(ctx)
    // await axios.post(base_url, note);
    // ctx.reply('You created a new image note successfully!')
    ctx.session.photo_action = false;
    func(ctx)
  }
})

// Start bot
bot.use(menuMiddleware)
bot.launch()

// Enable graceful stop
process.once('SIGINT', () => bot.stop('SIGINT'))
process.once('SIGTERM', () => bot.stop('SIGTERM'))


