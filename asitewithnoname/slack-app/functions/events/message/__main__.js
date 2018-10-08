const lib = require('lib')({ token: process.env.STDLIB_TOKEN });
const { storage } = lib.utils;

const RANKS_KEY = 'i11-ranks';
const singlePlus = /<\@(.+)>\s*\+{2}/i;
const singleSubtract = /<\@(.+)>\s*\-{2}/i;
const multiPlus = /<\@(.+)>\s*(\d+)\+/i;
const multiSubtract = /<\@(.+)>\s*(\d+)\-/i;

/**
* message event
*
*   All events use this template, simply create additional files with different
*   names to add event responses
*
*   See https://api.slack.com/events-api for more details.
*
* @param {string} user The user id of the user that invoked this event (name is usable as well)
* @param {string} channel The channel id the event was executed in (name is usable as well)
* @param {string} text The text contents of the event
* @param {object} event The full Slack event object
* @param {string} botToken The bot token for the Slack bot you have activated
* @returns {object}
*/
module.exports = (user, channel, text = '', event = {}, botToken = null, callback) => {

  // Only send a response to certain messages
  if (text.match(multiPlus)) {
    const results = multiPlus.exec(text);
    const goodUser = results[1];
    const multiplier = parseInt(results[2], 10);

    if (isSameUser(user, goodUser, callback)) return;

    updateRanks(goodUser, multiplier, newScore => {
      callback(null, {
        text: `Great work, <@${goodUser}>, ${multiplier} times! Current score: ${newScore}`,
        attachments: [],
      });
    });
  } else if (text.match(multiSubtract)) {
    const results = multiSubtract.exec(text);
    const badUser = results[1];
    const multiplier = parseInt(results[2], 10);

    if (isSameUser(user, badUser, callback)) return;

    updateRanks(badUser, (-1 * multiplier), newScore => {
      callback(null, {
        text: `Ugh, <@${badUser}> is the worst times ${multiplier}! Current score: ${newScore}`,
        attachments: [],
      });
    });
  } else if (text.match(singlePlus)) {
    const results = singlePlus.exec(text);
    const goodUser = results[1];

    if (isSameUser(user, goodUser, callback)) return;

    updateRanks(goodUser, 1, newScore => {
      callback(null, {
        text: `Good work, <@${goodUser}>! Current score: ${newScore}`,
        attachments: [],
      });
    });
  } else if (text.match(singleSubtract)) {
    const results = singleSubtract.exec(text);
    const badUser = results[1];

    if (isSameUser(user, badUser, callback)) return;

    updateRanks(badUser, -1, newScore => {
      callback(null, {
        text: `Bad form, <@${badUser}>! Current score: ${newScore}`,
        attachments: [],
      });
    });
  } else {
    callback(null, {});
  }
};

/**
 * Gets/sets score for user and returns new score
 *
 * @param {String} userName
 * @param {Number} amountToAdd
 * @param {Function} callback
 */
const updateRanks = (userName, amountToAdd, callback) => {
  storage.get(RANKS_KEY, (err, storedRanks) => {
    let ranks;

    if (err || !storedRanks) {
      console.log('No storage set, creating now...');

      ranks = {};
    } else {
      ranks = storedRanks;
    }

    if (!ranks[userName]) ranks[userName] = 0;

    ranks[userName] += amountToAdd;

    storage.set(RANKS_KEY, ranks, err => {
      callback(ranks[userName]);
    });
  });
};

/**
 * Used to verify points are not being awarded to same user
 *
 * @param {String} callingUser
 * @param {String} pointsUser
 * @param {Function} callbackForInvalid
 * @returns {Boolean} isSameUser
 */
const isSameUser = (callingUser, pointsUser, callbackForInvalid) => {
  if (!callingUser || !pointsUser) {
    callbackForInvalid(null, {});

    return true;
  }

  if (callingUser.trim().toUpperCase() === pointsUser.trim().toUpperCase()) {
    callbackForInvalid(null, {
      text: `Hey, what are you trying to pull, <@${callingUser}>?!`,
      attachments: [],
    });

    return true;
  }

  return false;
};
