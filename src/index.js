const {Telegraf} = require('telegraf');
const {MenuTemplate, MenuMiddleware, createBackMainMenuButtons, deleteMenuFromContext} = require('telegraf-inline-menu');
const session = require('telegraf/session');
const {Note, Joplin} = require("./joplin")
require('dotenv').config();

const telegram_token = process.env.TELEGRAM_BOT
const telegram_allowed_users_ids = process.env.TELEGRAM_UIDS
const joplin_token = process.env.JOPLIN_TOKEN
const base_url = process.env.JOPLIN_URL

const bot = new Telegraf(telegram_token)
const joplin = new Joplin(base_url, joplin_token)
bot.use(session({wd: "/"}))

function cwd(ctx, wd){
  ctx.session.wd = wd
}

function reset_wd(ctx){
  cwd(ctx, "/")
}

function cwd_id(ctx){
  if (ctx.session.wd)
  return ctx.session.wd.split("/").slice(-1)
  return "/"
}

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
      ctx.reply(`Creating a note at: ${ctx.session.wd}.\n Tell me the name for the note`)
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
  pwd: {
    desc: "Shows the current working path",
    cb: ctx => {
      ctx.replyWithMarkdown(`\`${ctx.session.wd}\``)
    }
  },
  ls: {
    desc: "List notes and folders on current path",
    cb: async ctx => {
      id = cwd_id(ctx)
      if (id){
        let notes = await joplin.fetchAll(`folders/${id}/notes`)
        if (notes.length == 0) {
          ctx.reply("No notes here")
        }else
          ctx.reply(notes.map(p => p.title).join('\n'))
      }

      let folders = await joplin.fetchAll("folders")
      if (folders.length == 0) {
        ctx.reply("No folders here")
        return
      }else{
        if (id)
          folders = folders.filter(folder => folder['parent_id'] === id)
        else
          folders = folders.filter(folder => folder['parent_id'] === "")
      }
      ctx.reply(folders.map(p => p.title).join('\n'))
    }
  },
  cd: {
    desc: "Changes folder",
    cb: ctx => {

    }
  },
  rm: {
    desc: "Removes a note",
    cb: ctx => {

    }
  },
  del: {
    desc: "Removes a folder",
    cb: ctx => {

    }
  },
  mv: {
    desc: "moves a note",
    cb: ctx => {

    }
  },
  move: {
    desc: "Moves a folder",
    cb: ctx => {

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
})

const cd_menu = new MenuTemplate(() => {
	const text = '_Hey_ *there*!'
	return {text, parse_mode: 'Markdown'}
})
cd_menu.interact('first', 'a', {
  do: async (ctx) => {
    ctx.reply('As am I!')
    return "/delete"
  }
})
cd_menu.interact('second', 'b', {
	joinLastRow: true,
  do: async (ctx) => {
    ctx.reply('As am I!')
    return "/"
  }
})
cd_menu.interact("close", 'c', {
  do: ctx => {
    deleteMenuFromContext(ctx)
    return false
  }
})
cd_menu.interact('Text', 'unique', {
	do: async ctx => ctx.answerCbQuery('You hit a button in a submenu')
})
cd_menu.manualRow(createBackMainMenuButtons())
menu.submenu("enter", "cd", cd_menu)
choose_menu = new MenuTemplate("Choose")
choose_menu.choose('unique', ['a', 'b'], {
  do: (ctx, key) => {
    ctx.answerCbQuery(`Lets ${key}`)
    return true
  },
	buttonText: (ctx, text) => {
    console.log(text)
		return text.toUpperCase()
	}
})
choose_menu.select('unique', ['human', 'bird'], {
	isSet: (ctx, key) => ctx.session.choice === key,
	set: (ctx, key) => {
		ctx.session.choice = key
    return true
	}
})
choose_menu.manualRow(createBackMainMenuButtons())
menu.submenu("choose", "choose", choose_menu)
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
  reset_wd(ctx)
  ctx.reply('Welcome to your Joplin notebook!, just type /help for available commands 😊')
})

bot.help((ctx) => {
  if (!is_valid_uid(ctx)) return;
  ctx.replyWithMarkdown(Object.keys(commands).reduce((message, cmd) => {
    return message + `/${cmd} - ${commands[cmd].desc}\n`
  }, "*Available commands are:*\n\n"))
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


