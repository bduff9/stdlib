const lib = require('lib')({ token: process.env.STDLIB_TOKEN });
const { storage } = lib.utils;

const RANKS_KEY = 'i11-ranks';
const MAX_LEADERS = 5;

/**
* /hello
*
*   Basic "Hello World" command.
*   All Commands use this template, simply create additional files with
*   different names to add commands.
*
*   See https://api.slack.com/slash-commands for more details.
*
* @param {string} user The user id of the user that invoked this command (name is usable as well)
* @param {string} channel The channel id the command was executed in (name is usable as well)
* @param {string} text The text contents of the command
* @param {object} command The full Slack command object
* @param {string} botToken The bot token for the Slack bot you have activated
* @returns {object}
*/
module.exports = (user, channel, text = '', command = {}, botToken = null, callback) => {
  let userName;

  if (text === 'me') {
    userName = user;

    storage.get(RANKS_KEY, (err, storedRanks) => {
      let score;

      if (err || !storedRanks) {
        callback(null, {
          text: 'No point activity yet',
          attachments: [],
        });
      } else {
        score = storedRanks[userName];

        callback(null, {
          text: `<@${userName}> is at ${score} points`,
          attachments: []
        });
      }
    });
  } else if (text.startsWith('top')) {
    const commandParts = text.split(' ');
    let numLeaders = parseInt(commandParts[1], 10) || MAX_LEADERS;

    storage.get(RANKS_KEY, (err, storedRanks) => {
      if (err || !storedRanks) {
        callback(null, {
          text: 'No point activity yet',
          attachments: [],
        });
      } else {
        let sortedRanks = Object.keys(storedRanks).map(name => {
          return {
            name,
            score: storedRanks[name],
          };
        }).filter(({ score }) => {
          let numScore = parseInt(score, 10);

          if (score !== numScore) return false;

          return score > 0;
        });

        let finalRanks = sortedRanks.sort((rankA, rankB) => rankB.score - rankA.score);
        let rankMessage = '';

        if (finalRanks.length > numLeaders) finalRanks = finalRanks.slice(0, numLeaders);

        rankMessage = finalRanks.reduce((message, { name, score }) => {
          return `${message}\n<@${name}>: ${score} points`;
        }, `Current Top ${finalRanks.length} Leaderboard:`);

        callback(null, {
          text: rankMessage,
          attachments: []
        });
      }
    });
  } else {
    callback(null, {
      text:
`The official Inspire11 Bot

Invite the bot to specific channels with \`/invite @i11_bot\`

*Commands*
\`/i11bot me\` - See your points
\`/i11bot top\` - See top ${MAX_LEADERS} points
\`/i11bot top N\` - See top N points
\`/i11bot help\` - See this help screen

*Assigning Points*
\`@username ++\` — Award 1 point to \`@username\`
\`@username --\` — Take away 1 point from \`@username\`
\`@username N+\` — Award N points to \`@username\`
\`@username N-\` — Take away N points from \`@username\`
`,
      attachments: []
    });
  }
};
