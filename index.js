// Import the Bolt package for building Slack apps
const { App } = require("@slack/bolt");

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

// Call the startApp function to start the app
startApp();
