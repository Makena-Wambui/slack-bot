// Import the Bolt package
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

// Call the startApp function to start the app
startApp();
