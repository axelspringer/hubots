const MESSAGE_RESERVED_KEYWORDS = ['channel', 'group', 'everyone', 'here']


// https://api.slack.com/docs/formatting
export class SlackFormatter {

  constructor(public dataStore) { }

  public links(text) {
    const regex = new RegExp(`\
<\
([@#!])?\
([^>|]+)\
(?:\\|\
([^>]+)\
)?\
>\
`, 'g')

    text = text.replace(regex, (m, type, link, label) => {
      switch (type) {

        case '@':
          if (label) { return `@${label}` }
          var user = this.dataStore.getUserById(link)
          if (user) {
            return `@${user.name}`
          }
          break

        case '#':
          if (label) { return `\#${label}` }
          var channel = this.dataStore.getChannelById(link)
          if (channel) {
            return `\#${channel.name}`
          }
          break

        case '!':
          if (Array.from(MESSAGE_RESERVED_KEYWORDS).includes(link)) {
            return `@${link}`
          } else if (label) {
            return label
          }
          return m

        default:
          link = link.replace(/^mailto:/, '')
          if (label && (-1 === link.indexOf(label))) {
            return `${label} (${link})`
          } else {
            return link
          }
      }
    })

    text = text.replace(/&lt/g, '<')
    text = text.replace(/&gt/g, '>')
    return text = text.replace(/&amp/g, '&')
  }


  /*
  Flattens message text and attachments into a multi-line string
  */
  public flatten(message) {
    const text = []

    // basic text messages
    if (message.text) { text.push(message.text) }

    // append all attachments
    for (let attachment of Array.from(message.attachments || [])) {
      text.push(attachment['fallback'])
    }

    // flatten array
    return text.join('\n')
  }


  /*
  Formats an incoming Slack message
  */
  public incoming(message) {
    return this.links(this.flatten(message))
  }
}
