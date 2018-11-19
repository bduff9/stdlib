const lib = require('lib')({ token: process.env.STDLIB_TOKEN });
const { storage } = lib.utils;

const {
  BROUGHT_DONUTS_REGEX,
  DONUT_HISTORY_KEY,
  LOCALE_STRING_FMT,
  LOCALE_STRING_OPTS,
  MAX_LEADERS,
  RANKS_KEY,
} = require('../../utils/constants');

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

  text = text.trim().toLowerCase();

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
  } else if (text === 'list donuts') {
    getAllDonutListing(donutList => {
      if (donutList.length === 0) return sendEmptyListMessage(callback);

      formatDonutList(donutList, callback);
    });
  } else if (text === 'next for donuts') {
    getAllDonutListing(donutList => {
      if (donutList.length === 0) return sendEmptyListMessage(callback);

      sendDonutReminder(donutList[0], callback);
    });
  } else if (text.match(BROUGHT_DONUTS_REGEX)) {
    const results = BROUGHT_DONUTS_REGEX.exec(text);
    const donutUser = results[1];

    if (isSameUser(user, donutUser, callback)) return;

    removeEarliestFromHistory(donutUser, newScore => {
      const message = (newScore === 0 ? 'You are all caught up...\n\nfor now' : `You still owe ${newScore} donut days.`);

      callback(null, {
        text: `Thanks for bringing donuts in, <@${donutUser}>!  ${message}`,
        attachments: [],
      });
    });
  } else if (user === 'UBXQ2BZDW' && text.startsWith('add')) {
    // Added this section so I can admin if needed
    const results = /@(\S+)\s*/i.exec(text);
    const userName = results[1];

    addUserToDonutHistory(userName, newCount => {
      const verb = (newCount > 1 ? `Now at ${newCount} in` : 'Added to');

      callback(null, {
        text: `Tough break, <@${userName}>. ${verb} donut history`,
        attachments: [],
      });
    });
  } else {
    let invalidMsg = '';

    if (!text.startsWith('help')) {
      invalidMsg = `Invalid command: ${text}

`;
    }

    callback(null, {
      text:
`${invalidMsg}The official Inspire11 Bot

Invite the bot to specific channels with \`/invite @i11_bot\`

*Commands*
\`/i11bot me\` - See your points
\`/i11bot top\` - See top ${MAX_LEADERS} points
\`/i11bot top N\` - See top N points
\`/i11bot list donuts\` - See all of donut list
\`/i11bot next for donuts\` - Notify the next on the list to bring donuts
\`/i11bot @username brought donuts\` - Remove earliest infraction from \`@username\`
\`/i11bot help\` - See this help screen

*Assigning Points*
\`@username ++\` — Award 1 point to \`@username\`
\`@username --\` — Take away 1 point from \`@username\`
\`@username N+\` — Award N points to \`@username\`
\`@username N-\` — Take away N points from \`@username\`

*Adding to Donut List*
Send out a poll using the word "donut", such as:
\`/poll "Should I bring donuts?" "Yes" "Heck yes"\`
`,
      attachments: []
    });
  }
};

/**
 * Used to add/create a timestamp of when computer was left unlocked
 *
 * @param {String} userName The username of the offending user
 * @param {Function} callback The callback after the offense has been recorded
 */
const addUserToDonutHistory = (userName, callback) => {
  const now = new Date().getTime();

  storage.get(DONUT_HISTORY_KEY, (err, storedHistory) => {
    let history;

    if (err) {
      console.error('Failed to get history', err);

      return;
    } else if (!storedHistory) {
      console.log('No storage set, creating now...');

      history = {};
    } else {
      history = storedHistory;
    }

    if (!history[userName]) history[userName] = [];

    history[userName].push(now);

    storage.set(DONUT_HISTORY_KEY, history, err => {
      callback(history[userName].length);
    });
  });
};

/**
 * Used to verify donuts are not being removed from same user
 *
 * @param {String} callingUser
 * @param {String} donutsUser
 * @param {Function} callbackForInvalid
 * @returns {Boolean} isSameUser
 */
const isSameUser = (callingUser, donutsUser, callbackForInvalid) => {
  if (!callingUser || !donutsUser) {
    callbackForInvalid(null, {});

    return true;
  }

  if (callingUser.trim().toUpperCase() === donutsUser.trim().toUpperCase()) {
    callbackForInvalid(null, {
      text: `Great work, <@${callingUser}>!  Please have someone else confirm and run this command to lower your donut listing`,
      attachments: [],
    });

    return true;
  }

  return false;
};

/**
 * Used to get every listing from the donut crew
 * @param {Function} callback Function to run after getting listing from storage
 */
const getAllDonutListing = callback => {
  storage.get(DONUT_HISTORY_KEY, (err, storedHistory) => {
    let donutObjects;
    let history;

    if (err) {
      console.error('Failed to get history', err);

      history = {};
    } else if (!storedHistory) {
      console.log('No storage set, creating now...');

      history = {};
    } else {
      history = storedHistory;
    }

    donutObjects = Object.entries(history).map(entry => ({
      userName: entry[0],
      history: entry[1],
      earliest: entry[1].slice(0, 1)[0],
    })).filter(({ history }) => history.length > 0);

    donutObjects.sort((d1, d2) => d1.earliest - d2.earliest);

    callback(donutObjects);
  });
};

const sendEmptyListMessage = callback => {
  callback(null, {
    text: 'Hooray!  No one owes any donuts currently',
    attachments: [],
  });
};

const formatDonutList = (donutList, callback) => {
  let message = `*Donut List as of ${new Date().toLocaleString(LOCALE_STRING_FMT, LOCALE_STRING_OPTS)}*`;
  let counter = 0;

  donutList.forEach(({ earliest, history, userName }) => {
    const dateAdded = new Date(earliest);
    const historyCount = history.length;
    const days = (historyCount === 1 ? 'day' : 'days');
    const added = (historyCount === 1 ? 'added' : 'first added');

    if (history.length === 0) return;

    message += `\n${++counter}. <@${userName}> owes ${historyCount} donut ${days} (${added} ${dateAdded.toLocaleString(LOCALE_STRING_FMT, LOCALE_STRING_OPTS)})`;
  });

  callback(null, {
    text: message,
    attachments: [],
  });
};

/**
 * Used to send reminder to user who us up next (i.e. has earliest offense)
 *
 * @param {Object} nextForDonuts Object containing user name and history
 * @param {Function} callback Function to send message
 */
const sendDonutReminder = (nextForDonuts = {}, callback) => {
  const { earliest, history, userName } = nextForDonuts;
  const dateAdded = new Date(earliest);
  const message = `Heads up, <@${userName}>, you are the next to owe donuts.

This is from ${dateAdded.toLocaleString(LOCALE_STRING_FMT, LOCALE_STRING_OPTS)}.  You currently owe ${history.length} donut days total.`;

  callback(null, {
    text: message,
    attachments: [],
  });
};

/**
 * Used to mark someone off once for bringing in donuts
 *
 * @param {String} userName The username to mark off
 * @param {Function} callback The callback to run after getting new score
 */
const removeEarliestFromHistory = (userName, callback) => {
  storage.get(DONUT_HISTORY_KEY, (err, storedHistory) => {
    let history;

    if (err) {
      console.error('Failed to get history', err);

      return;
    } else if (!storedHistory) {
      console.log('No storage set, creating now...');

      history = {};
    } else {
      history = storedHistory;
    }

    if (!history[userName]) history[userName] = [0];

    history[userName] = history[userName].slice(1);

    storage.set(DONUT_HISTORY_KEY, history, err => {
      callback(history[userName].length);
    });
  });
};
