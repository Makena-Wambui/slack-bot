// Import the Bolt package for building Slack apps
const { App } = require("@slack/bolt");
// chrono-node for parsing natural language dates
const chrono = require("chrono-node");
const cron = require("node-cron");

// Load environment variables from .env file so we can use them in our app
require("dotenv").config();

// Create a new Bolt App instance from the App class with our bot token and signing secret and app token
const app = new App({
  token: process.env.SLACK_BOT_TOKEN,
  signingSecret: process.env.SLACK_SIGNING_SECRET,
  appToken: process.env.APP_TOKEN,
  socketMode: true,
});

async function startApp() {
  // Start the app on port 3000 or the port defined in the PORT environment variable
  const port = process.env.PORT || 3000;
  await app.start(port);
  console.log(`⚡️ Slack Bolt app is running on port ${port}!`);
}

app.command("/hello", async ({ command, ack, say }) => {
  // Acknowledge the command request
  await ack();

  // Respond to the command with a greeting message
  await say(`Hello, <@${command.user_id}>!`);
});

app.command("/say_name", async ({ command, ack, say }) => {
  // Acknowledge the command request
  await ack();

  // Respond to the command with the user's name
  await say(`Your name is <@${command.user_id}>.`);
});

app.command("/founders", async ({ command, ack, say }) => {
  // Acknowledge the command request
  await ack();

  // Respond to the command with the names of the founders
  await say(
    `The co-founders of Code Blossom are Marion Schleifer and Nadia Baldelli.`,
  );
});

app.command("/add_numbers", async ({ command, ack, say }) => {
  // Acknowledge the command request
  await ack();

  // Extract numbers from the command text and convert them to an array of numbers
  const numbers = command.text.split(" ");

  // Calculate the sum of the numbers using reduce
  const sum = numbers.reduce((total, num) => total + Number(num), 0);

  // Respond to the command with the sum of the numbers
  await say(`The sum of the numbers is ${sum}.`);
});

// app.command("/random_quote", async ({ command, ack, say }) => {
//   // Acknowledge the command request
//   await ack();

//   // Fetch from the Quotable Quote API
//   const response = await fetch("https://api.quotable.io/random");

//   const quote = await response.json();

//   // Respond to the command with the random quote and handle errors with try-catch block
//   try {
//     await say(`"${quote.content}" - ${quote.author}`);
//   } catch (error) {
//     await say("Sorry, I couldn't fetch a quote at this time.");
//   }
// });

app.command("/help", async ({ command, ack, say }) => {
  // Acknowledge the command request
  await ack();

  // Respond to the command with a list of available commands
  await say(
    `Here are the available commands:
    /hello - Greet the user
    /say_name - Tell the user their name
    /founders - Get the names of the founders of Code Blossom
    /add_numbers [num1] [num2] ... - Add a list of numbers and return the sum
    /help - List all available commands
    /random-quotes - Generate a randomquote
    `,
  );
});

// In-memory poll storage (replace with DB for persistence)
const polls = {};

app.command("/poll", async ({ command, ack, respond, client }) => {
  await ack();

  const matches = command.text.match(/"([^"]+)"/g);
  if (!matches || matches.length < 2) {
    return respond({
      text: '❌ Usage: /poll "Question" "Option1" "Option2" ...',
      response_type: "ephemeral",
    });
  }

  const question = matches[0].replace(/"/g, "");
  const options = matches.slice(1).map((opt) => opt.replace(/"/g, ""));

  polls[command.channel_id] = {
    question,
    options,
    votes: {}, // { userId: [options] }
    ts: null,
    creator: command.user_id,
  };

  const blocks = buildPollBlocks(question, options, {});

  const result = await client.chat.postMessage({
    channel: command.channel_id,
    blocks,
    text: `Poll: ${question}`,
  });

  polls[command.channel_id].ts = result.ts;
});

// Handle votes (multiple allowed)
app.action(/vote_.*/, async ({ body, ack, client }) => {
  await ack();

  const channelId = body.channel.id;
  const userId = body.user.id;
  const option = body.actions[0].value;

  const poll = polls[channelId];
  if (!poll.votes[userId]) {
    poll.votes[userId] = [];
  }

  // Toggle vote
  if (poll.votes[userId].includes(option)) {
    poll.votes[userId] = poll.votes[userId].filter((v) => v !== option);
  } else {
    poll.votes[userId].push(option);
  }

  const blocks = buildPollBlocks(poll.question, poll.options, poll.votes);

  await client.chat.update({
    channel: channelId,
    ts: poll.ts,
    blocks,
    text: `Poll: ${poll.question}`,
  });
});

// Close poll
app.command("/closepoll", async ({ command, ack, respond, client }) => {
  await ack();

  const poll = polls[command.channel_id];
  if (!poll) {
    return respond({
      text: "❌ No active poll in this channel.",
      response_type: "ephemeral",
    });
  }

  // Optional: restrict closing to poll creator
  if (command.user_id !== poll.creator) {
    return respond({
      text: "⚠️ Only the poll creator can close this poll.",
      response_type: "ephemeral",
    });
  }

  // Count votes
  const counts = poll.options.reduce((acc, opt) => {
    acc[opt] = Object.values(poll.votes)
      .flat()
      .filter((v) => v === opt).length;
    return acc;
  }, {});

  // Find max votes
  const maxVotes = Math.max(...Object.values(counts));
  const winners = Object.keys(counts).filter((opt) => counts[opt] === maxVotes);

  await client.chat.postMessage({
    channel: command.channel_id,
    text: `📢 Poll closed: *${poll.question}*\nWinning option(s): ${winners.join(", ")} with ${maxVotes} votes.`,
  });

  // Clear poll
  delete polls[command.channel_id];
});

// Helper: build poll blocks with counts
function buildPollBlocks(question, options, votes) {
  const counts = options.reduce((acc, opt) => {
    acc[opt] = Object.values(votes)
      .flat()
      .filter((v) => v === opt).length;
    return acc;
  }, {});

  return [
    {
      type: "section",
      text: { type: "mrkdwn", text: `📊 *${question}*` },
    },
    {
      type: "actions",
      elements: options.map((opt, i) => ({
        type: "button",
        text: { type: "plain_text", text: `${opt} (${counts[opt]})` },
        action_id: `vote_${i}`,
        value: opt,
      })),
    },
  ];
}

app.command("/coffee", async ({ command, ack, respond, client }) => {
  await ack();

  try {
    // Get all members of the channel
    const result = await client.conversations.members({
      channel: command.channel_id,
    });

    const members = result.members.filter((m) => m !== command.user_id); // exclude the invoker

    if (members.length === 0) {
      return respond({
        text: "❌ No other members found in this channel.",
        response_type: "ephemeral",
      });
    }

    // Pick a random member
    const buddy = members[Math.floor(Math.random() * members.length)];

    await respond({
      text: `☕ <@${command.user_id}> has been paired with <@${buddy}> for a coffee chat!`,
      response_type: "in_channel",
    });
  } catch (error) {
    console.error(error);
    await respond({
      text: "❌ Failed to find a coffee buddy.",
      response_type: "ephemeral",
    });
  }
});

// Helper to parse recurring time expressions
function parseRecurring(timeExpr) {
  // Example: "every September 15 at 9am" (yearly)
  let match = timeExpr.match(/every (\w+) (\d{1,2}) at (\d+)(am|pm)/i);
  if (match) {
    const monthNames = {
      january: 1,
      february: 2,
      march: 3,
      april: 4,
      may: 5,
      june: 6,
      july: 7,
      august: 8,
      september: 9,
      october: 10,
      november: 11,
      december: 12,
    };
    const month = monthNames[match[1].toLowerCase()];
    const day = parseInt(match[2], 10);
    let hour = parseInt(match[3], 10);
    const meridian = match[4].toLowerCase();
    if (meridian === "pm" && hour !== 12) hour += 12;
    if (meridian === "am" && hour === 12) hour = 0;

    return `0 ${hour} ${day} ${month} *`; // yearly
  }

  // Example: "every 1st at 10am" (monthly)
  match = timeExpr.match(/every (\d{1,2})(st|nd|rd|th) at (\d+)(am|pm)/i);
  if (match) {
    const day = parseInt(match[1], 10);
    let hour = parseInt(match[3], 10);
    const meridian = match[4].toLowerCase();
    if (meridian === "pm" && hour !== 12) hour += 12;
    if (meridian === "am" && hour === 12) hour = 0;

    return `0 ${hour} ${day} * *`; // monthly
  }

  // Fallback: weekly parser (from earlier)
  match = timeExpr.match(/every (\w+) at (\d+)(am|pm)/i);
  if (match) {
    const days = {
      sunday: 0,
      monday: 1,
      tuesday: 2,
      wednesday: 3,
      thursday: 4,
      friday: 5,
      saturday: 6,
    };
    const day = days[match[1].toLowerCase()];
    let hour = parseInt(match[2], 10);
    const meridian = match[3].toLowerCase();
    if (meridian === "pm" && hour !== 12) hour += 12;
    if (meridian === "am" && hour === 12) hour = 0;

    return `0 ${hour} * * ${day}`; // weekly
  }

  return null;
}

const reminders = {};
// Structure: { channelId: { taskName: { job, type, schedule } } }

app.command("/remindme", async ({ command, ack, respond, client }) => {
  await ack();

  const matches = command.text.match(/"([^"]+)"/g);
  if (!matches || matches.length < 2) {
    return respond({
      text: '❌ Usage: /remindme "Task" "Time expression"',
      response_type: "ephemeral",
    });
  }

  const task = matches[0].replace(/"/g, "");
  const timeExpr = matches[1].replace(/"/g, "");

  if (/every/i.test(timeExpr)) {
    const cronExpr = parseRecurring(timeExpr);
    if (!cronExpr) {
      return respond({
        text: "⚠️ Could not parse recurring time.",
        response_type: "ephemeral",
      });
    }

    const job = cron.schedule(cronExpr, async () => {
      await client.chat.postMessage({
        channel: command.channel_id,
        text: `⏰ Recurring reminder: ${task}`,
      });
    });

    if (!reminders[command.channel_id]) reminders[command.channel_id] = {};
    reminders[command.channel_id][task] = {
      job,
      type: "recurring",
      schedule: timeExpr,
    };

    return respond({
      text: `✅ Recurring reminder set: *${task}* (${timeExpr}).`,
      response_type: "ephemeral",
    });
  }

  // One-time reminder
  const parsedDate = chrono.parseDate(timeExpr);
  if (!parsedDate) {
    return respond({
      text: "⚠️ Could not understand the time expression.",
      response_type: "ephemeral",
    });
  }

  const delayMs = parsedDate.getTime() - Date.now();
  if (delayMs <= 0) {
    return respond({
      text: "⚠️ That time is in the past.",
      response_type: "ephemeral",
    });
  }

  setTimeout(async () => {
    await client.chat.postMessage({
      channel: command.channel_id,
      text: `⏰ Reminder: ${task}`,
    });
    // Remove after firing
    delete reminders[command.channel_id][task];
  }, delayMs);

  if (!reminders[command.channel_id]) reminders[command.channel_id] = {};
  reminders[command.channel_id][task] = {
    type: "one-time",
    schedule: parsedDate.toLocaleString(),
  };

  await respond({
    text: `✅ Reminder set: *${task}* at ${parsedDate.toLocaleString()}`,

    response_type: "ephemeral",
  });
});

// List reminders
app.command("/listreminders", async ({ command, ack, respond }) => {
  await ack();

  const channelReminders = reminders[command.channel_id];
  if (!channelReminders || Object.keys(channelReminders).length === 0) {
    return respond({
      text: "⚠️ No active reminders in this channel.",
      response_type: "ephemeral",
    });
  }

  let listText = "*📋 Active Reminders:*\n";
  for (const [task, info] of Object.entries(channelReminders)) {
    listText += `• ${task} — ${info.type} (${info.schedule})\n`;
  }

  return respond({
    text: listText,
    response_type: "ephemeral",
  });
});

app.command("/cancelme", async ({ command, ack, respond }) => {
  await ack();

  const task = command.text.trim();

  // If no task name provided, cancel the most recent reminder in this channel
  const channelReminders = reminders[command.channel_id];
  if (!channelReminders || Object.keys(channelReminders).length === 0) {
    return respond({
      text: "⚠️ No active reminders to cancel in this channel.",
      response_type: "ephemeral",
    });
  }

  if (!task) {
    // Cancel the most recent reminder
    const lastTask = Object.keys(channelReminders).pop();
    channelReminders[lastTask].job.stop();
    delete channelReminders[lastTask];

    return respond({
      text: `🛑 Most recent reminder *${lastTask}* has been cancelled.`,
      response_type: "ephemeral",
    });
  }

  // Cancel by task name
  if (channelReminders[task]) {
    channelReminders[task].job.stop();
    delete channelReminders[task];

    return respond({
      text: `🛑 Reminder *${task}* has been cancelled.`,
      response_type: "ephemeral",
    });
  }

  return respond({
    text: `⚠️ No active reminder found for *${task}*.`,
    response_type: "ephemeral",
  });
});

// Call the startApp function to start the app

startApp();
