// Import the Bolt package
const { App } = require("@slack/bolt");
const Database = require("better-sqlite3");
const path = require("path");

// Initialize SQLite database
const db = new Database(path.join(__dirname, "team_data.db"));

// Create tables if they don't exist
db.exec(`
  CREATE TABLE IF NOT EXISTS checkins (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT NOT NULL,
    user_name TEXT NOT NULL,
    checkin_time DATETIME DEFAULT CURRENT_TIMESTAMP,
    date TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS blockers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT NOT NULL,
    user_name TEXT NOT NULL,
    blocker TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    date TEXT NOT NULL,
    resolved INTEGER DEFAULT 0
  );
`);

// Create a new Bolt App instance from the App class with our bot token and signing secret and app token
const app = new App({
  token: process.env.SLACK_BOT_TOKEN || "xoxb-your-bot-token",
  signingSecret: process.env.SLACK_SIGNING_SECRET || "your-signing-secret",
  appToken: process.env.APP_TOKEN || "xapp-your-app-token",
  socketMode: true,
});

async function startApp() {
  // Start the app on port 3000 or the port defined in the PORT environment variable
  const port = process.env.PORT || 3000;
  await app.start(port);
  console.log(`⚡️ Slack Bolt app is running on port ${port}!`);
}

// Get today's date in YYYY-MM-DD format
function getTodayDate() {
  return new Date().toISOString().split("T")[0];
}

// Get the date for a specific number of days ago
function getDateDaysAgo(days) {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date.toISOString().split("T")[0];
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

// Check-in command
app.command("/checkin", async ({ command, ack, say }) => {
  await ack();

  const userId = command.user_id;
  const today = getTodayDate();

  // Check if user already checked in today
  const existingCheckin = db.prepare(
    "SELECT * FROM checkins WHERE user_id = ? AND date = ?"
  ).get(userId, today);

  if (existingCheckin) {
    await say(`You've already checked in today at ${existingCheckin.checkin_time}`);
    return;
  }

  // Get user info from Slack (in a real app, you'd use the Slack client)
  const userName = `<@${userId}>`;

  // Insert checkin record
  db.prepare(
    "INSERT INTO checkins (user_id, user_name, date) VALUES (?, ?, ?)"
  ).run(userId, userName, today);

  await say(`✅ Welcome, ${userName}! You've successfully checked in for ${today}`);
});

// Report a blocker command
app.command("/blocker", async ({ command, ack, say }) => {
  await ack();

  const userId = command.user_id;
  const blockerText = command.text.trim();
  const today = getTodayDate();

  if (!blockerText) {
    await say(`Please provide a description of your blocker. Usage: /blocker <description>`);
    return;
  }

  const userName = `<@${userId}>`;

  // Insert blocker record
  db.prepare(
    "INSERT INTO blockers (user_id, user_name, blocker, date) VALUES (?, ?, ?, ?)"
  ).run(userId, userName, blockerText, today);

  await say(`⚠️ Block noted, ${userName}! blocker: "${blockerText}"`);
});

// Team summary command
app.command("/team_summary", async ({ command, ack, say }) => {
  await ack();

  const days = parseInt(command.text) || 0; // Default to today if no days specified
  const startDate = getDateDaysAgo(days);
  const endDate = days === 0 ? getTodayDate() : getTodayDate();

  // Get all checkins for the date range
  const checkins = db.prepare(
    "SELECT * FROM checkins WHERE date BETWEEN ? AND ? ORDER BY checkin_time"
  ).all(startDate, endDate);

  // Get all blockers for the date range
  const blockers = db.prepare(
    "SELECT * FROM blockers WHERE date BETWEEN ? AND ? ORDER BY created_at"
  ).all(startDate, endDate);

  let summary = `📊 *Team Summary* (${days === 0 ? "Today" : `Last ${days} days`})\n\n`;

  // Checked in members
  summary += `*✅ Checked In (${checkins.length}):*\n`;
  if (checkins.length === 0) {
    summary += `_No checkins recorded_\n`;
  } else {
    checkins.forEach((checkin) => {
      summary += `• ${checkin.user_name} - ${checkin.checkin_time}\n`;
    });
  }

  summary += `\n`;

  // Common blockers
  summary += `*⚠️ Blockers (${blockers.length}):*\n`;
  if (blockers.length === 0) {
    summary += `_No blockers reported_\n`;
  } else {
    blockers.forEach((blocker) => {
      const status = blocker.resolved ? "✅" : "🔴";
      summary += `${status} ${blocker.user_name}: ${blocker.blocker}\n`;
    });
  }

  await say(summary);
});

// Resolve a blocker (for team leads/managers)
app.command("/resolve_blocker", async ({ command, ack, say }) => {
  await ack();

  const blockerId = command.text.trim();

  if (!blockerId) {
    await say(`Please provide the blocker ID. Usage: /resolve_blocker <id>`);
    return;
  }

  const result = db.prepare(
    "UPDATE blockers SET resolved = 1 WHERE id = ?"
  ).run(blockerId);

  if (result.changes > 0) {
    await say(`✅ Blocker #${blockerId} has been marked as resolved!`);
  } else {
    await say(`❌ Blocker #${blockerId} not found.`);
  }
});

// Call the startApp function to start the app
startApp();
