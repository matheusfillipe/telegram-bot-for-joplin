const axios = require('axios');
const {exec} = require("child_process");

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


class Joplin {
  constructor(base_url, token) {
    this.token = token
    this.base_url = base_url
  }

	sync() {
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

	makeUrl(endpoint, args) {
    if (!args)
      args = []
    if (!Array.isArray(args))
      args = Object.keys(args).map((key) => key + "=" + args[key])
    const arg = args.length > 0 ? ("&" + args.join("&")) : ''
    return this.base_url + endpoint + "?token=" + this.token + arg
  }
  async fetchJson(endpoint, args) {
    const url = this.makeUrl(endpoint, args)
    const response = await axios.get(url)
    return response.data
  }

  async fetchAll(endpoint, args = []) {
    let pageNum = 1;
    let items = [];

    let response = {}
    do {
      response = await this.fetchJson(endpoint, ["page=" + pageNum++, ...args]);
      items.push(...response.items)
    } while (response.has_more)
    return items
  }

  async post(endpoint, data) {
    return await axios.post(this.makeUrl(endpoint), data).data
  }
}
module.exports = {Note, Joplin}
