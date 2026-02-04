// Import the Bolt package
const { App, DirectMessage } = require("@slack/bolt");
const Database = require("better-sqlite3");
const path = require("path");

// Load environment variables from .env file
require("dotenv").config();

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
    resolved INTEGER DEFAULT 0,
    priority TEXT DEFAULT 'medium',
    category TEXT DEFAULT 'general',
    resolved_by TEXT,
    resolved_at DATETIME,
    resolution_notes TEXT
  );
`);

// Add columns to existing blockers table if they don't exist
try {
  db.exec("ALTER TABLE blockers ADD COLUMN priority TEXT DEFAULT 'medium';");
} catch (e) { /* column may already exist */ }
try {
  db.exec("ALTER TABLE blockers ADD COLUMN category TEXT DEFAULT 'general';");
} catch (e) { /* column may already exist */ }
try {
  db.exec("ALTER TABLE blockers ADD COLUMN resolved_by TEXT;");
} catch (e) { /* column may already exist */ }
try {
  db.exec("ALTER TABLE blockers ADD COLUMN resolved_at DATETIME;");
} catch (e) { /* column may already exist */ }
try {
  db.exec("ALTER TABLE blockers ADD COLUMN resolution_notes TEXT;");
} catch (e) { /* column may already exist */ }

// Create a new Bolt App instance from the App class with our bot token and signing secret and app token
const app = new App({
  token: process.env.SLACK_BOT_TOKEN || "",
  signingSecret: process.env.SLACK_SIGNING_SECRET || "",
  appToken: process.env.APP_TOKEN || "",
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

// Login command
app.command("/login", async ({ command, ack, say }) => {
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

// Report a blocker command with priority and category
app.command("/blocker", async ({ command, ack, say }) => {
  await ack();

  const userId = command.user_id;
  const text = command.text.trim();
  const today = getTodayDate();

  // Parse input: can be "priority:category:blocker description" or just "blocker description"
  let priority = "medium";
  let category = "general";
  let blockerText = text;

  if (text.includes(":")) {
    const parts = text.split(":");
    if (parts.length >= 3) {
      priority = parts[0].toLowerCase().trim();
      category = parts[1].toLowerCase().trim();
      blockerText = parts.slice(2).join(":").trim();
    } else if (parts.length === 2) {
      // Assume "priority:blocker description" or "category:blocker description"
      if (["high", "medium", "low"].includes(parts[0].toLowerCase().trim())) {
        priority = parts[0].toLowerCase().trim();
        blockerText = parts[1].trim();
      } else {
        category = parts[0].toLowerCase().trim();
        blockerText = parts[1].trim();
      }
    }
  }

  if (!blockerText) {
    await say({
      blocks: [
        {
          type: "section",
          text: {
            type: "mrkdwn",
            text: "❌ *Please provide a description of your blocker.*"
          }
        },
        {
          type: "section",
          text: {
            type: "mrkdwn",
            text: "_Usage: /blocker [priority:category:]description_"
          }
        },
        {
          type: "section",
          text: {
            type: "mrkdwn",
            text: "*Priority:* `high`, `medium`, `low`\n*Category:* `technical`, `dependency`, `resource`, `general`"
          }
        }
      ]
    });
    return;
  }

  const userName = `<@${userId}>`;
  const priorityEmoji = { high: "🔴", medium: "🟡", low: "🟢" };
  const categoryEmoji = {
    technical: "💻",
    dependency: "🔗",
    resource: "📦",
    general: "📌"
  };

  // Insert blocker record
  const result = db.prepare(
    "INSERT INTO blockers (user_id, user_name, blocker, date, priority, category) VALUES (?, ?, ?, ?, ?, ?)"
  ).run(userId, userName, blockerText, today, priority, category);

  await say({
    blocks: [
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: `${priorityEmoji[priority]} *Blocker Recorded*${categoryEmoji[category]}`
        }
      },
      {
        type: "section",
        fields: [
          {
            type: "mrkdwn",
            text: `*Blocker ID:* #${result.lastInsertRowid}`
          },
          {
            type: "mrkdwn",
            text: `*Reported by:* ${userName}`
          },
          {
            type: "mrkdwn",
            text: `*Priority:* ${priorityEmoji[priority]} ${priority.toUpperCase()}`
          },
          {
            type: "mrkdwn",
            text: `*Category:* ${categoryEmoji[category]} ${category}`
          }
        ]
      },
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: `*Description:* ${blockerText}`
        }
      },
      {
        type: "context",
        elements: [
          {
            type: "mrkdwn",
            text: `📅 Date: ${today}`
          }
        ]
      }
    ]
  });
});

// Team summary command with detailed stats and Block Kit
app.command("/team_summary", async ({ command, ack, say }) => {
  await ack();

  const days = parseInt(command.text) || 0; // Default to today if no days specified
  const startDate = getDateDaysAgo(days);
  const endDate = getTodayDate();

  // Get all checkins for the date range
  const checkins = db.prepare(
    "SELECT * FROM checkins WHERE date BETWEEN ? AND ? ORDER BY checkin_time"
  ).all(startDate, endDate);

  // Get all blockers for the date range
  const blockers = db.prepare(
    "SELECT * FROM blockers WHERE date BETWEEN ? AND ? ORDER BY created_at"
  ).all(startDate, endDate);

  // Calculate stats
  const activeBlockers = blockers.filter(b => !b.resolved);
  const resolvedBlockers = blockers.filter(b => b.resolved);
  const highPriorityBlockers = activeBlockers.filter(b => b.priority === 'high');
  const uniqueCheckins = new Set(checkins.map(c => c.user_id)).size;

  // Priority and category emojis
  const priorityEmoji = { high: "🔴", medium: "🟡", low: "🟢" };
  const categoryEmoji = {
    technical: "💻",
    dependency: "🔗",
    resource: "📦",
    general: "📌"
  };

  const blocks = [
    {
      type: "header",
      text: {
        type: "plain_text",
        text: `📊 Team Summary ${days > 0 ? `(Last ${days} days)` : "(Today)"}`,
        emoji: true
      }
    },
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: "*📈 Statistics Overview*"
      }
    },
    {
      type: "section",
      fields: [
        {
          type: "mrkdwn",
          text: `*✅ Check-ins:*\n${uniqueCheckins} members`
        },
        {
          type: "mrkdwn",
          text: `*⚠️ Active Blockers:*\n${activeBlockers.length} unresolved`
        },
        {
          type: "mrkdwn",
          text: `*✅ Resolved Blockers:*\n${resolvedBlockers.length} resolved`
        },
        {
          type: "mrkdwn",
          text: `*🔴 High Priority:*\n${highPriorityBlockers.length} critical`
        }
      ]
    }
  ];

  // Active blockers section
  if (activeBlockers.length > 0) {
    blocks.push({
      type: "divider"
    });
    blocks.push({
      type: "section",
      text: {
        type: "mrkdwn",
        text: "*🔴 Active Blockers*"
      }
    });

    activeBlockers.forEach((blocker) => {
      blocks.push({
        type: "section",
        text: {
          type: "mrkdwn",
          text: `${priorityEmoji[blocker.priority]} *#${blocker.id}* ${blocker.user_name}: ${blocker.blocker}`
        },
        accessory: {
          type: "button",
          text: {
            type: "plain_text",
            text: "Resolve",
            emoji: true
          },
          value: blocker.id.toString(),
          action_id: "resolve_blocker_modal"
        }
      });
      blocks.push({
        type: "context",
        elements: [
          {
            type: "mrkdwn",
            text: `${categoryEmoji[blocker.category] || "📌"} ${blocker.category || "general"} | 📅 ${blocker.date}`
          }
        ]
      });
    });
  }

  // Resolved blockers section
  if (resolvedBlockers.length > 0) {
    blocks.push({
      type: "divider"
    });
    blocks.push({
      type: "section",
      text: {
        type: "mrkdwn",
        text: "*✅ Recently Resolved*"
      }
    });

    resolvedBlockers.slice(0, 5).forEach((blocker) => {
      blocks.push({
        type: "context",
        elements: [
          {
            type: "mrkdwn",
            text: `✅ *#${blocker.id}* ${blocker.user_name}: ${blocker.blocker.substring(0, 50)}${blocker.blocker.length > 50 ? "..." : ""}`
          }
        ]
      });
    });
  }

  // Checked in members
  if (checkins.length > 0) {
    blocks.push({
      type: "divider"
    });
    blocks.push({
      type: "section",
      text: {
        type: "mrkdwn",
        text: "*✅ Today's Check-ins*"
      }
    });
    
    const checkinList = checkins.slice(0, 10).map(c => `${c.user_name} - ${c.checkin_time.split(" ")[1]}`).join("\n");
    blocks.push({
      type: "context",
      elements: [
        {
          type: "mrkdwn",
          text: checkinList + (checkins.length > 10 ? `\n_...and ${checkins.length - 10} more_` : "")
        }
      ]
    });
  }

  await say({ blocks });
});

// Resolve a blocker command with notes and detailed feedback
app.command("/resolve_blocker", async ({ command, ack, say }) => {
  await ack();

  const userId = command.user_id;
  const userName = `<@${userId}>`;
  const text = command.text.trim();

  if (!text) {
    await say({
      blocks: [
        {
          type: "section",
          text: {
            type: "mrkdwn",
            text: "❌ *Please provide the blocker ID and optional resolution notes.*"
          }
        },
        {
          type: "section",
          text: {
            type: "mrkdwn",
            text: "_Usage: /resolve_blocker <id> [notes]_"
          }
        },
        {
          type: "context",
          elements: [
            {
              type: "mrkdwn",
              text: "Example: `/resolve_blocker 5 Fixed by updating dependencies`"
            }
          ]
        }
      ]
    });
    return;
  }

  // Parse blocker ID and notes (format: "id notes...")
  const parts = text.split(" ");
  const blockerId = parts[0];
  const resolutionNotes = parts.slice(1).join(" ").trim() || "Resolved";

  // First, check if blocker exists
  const existingBlocker = db.prepare(
    "SELECT * FROM blockers WHERE id = ?"
  ).get(blockerId);

  if (!existingBlocker) {
    await say({
      blocks: [
        {
          type: "section",
          text: {
            type: "mrkdwn",
            text: `❌ *Blocker #${blockerId} not found.*`
          }
        }
      ]
    });
    return;
  }

  if (existingBlocker.resolved) {
    await say({
      blocks: [
        {
          type: "section",
          text: {
            type: "mrkdwn",
            text: `⚠️ *Blocker #${blockerId} was already resolved.*`
          }
        }
      ]
    });
    return;
  }

  // Update the blocker
  const resolvedAt = new Date().toISOString();
  const result = db.prepare(
    "UPDATE blockers SET resolved = 1, resolved_by = ?, resolved_at = ?, resolution_notes = ? WHERE id = ?"
  ).run(userName, resolvedAt, resolutionNotes, blockerId);

  if (result.changes > 0) {
    await say({
      blocks: [
        {
          type: "section",
          text: {
            type: "mrkdwn",
            text: "✅ *Blocker Resolved Successfully!*"
          }
        },
        {
          type: "section",
          text: {
            type: "mrkdwn",
            text: `*Original Blocker:* ${existingBlocker.blocker}`
          }
        },
        {
          type: "section",
          fields: [
            {
              type: "mrkdwn",
              text: `*Blocker ID:* #${blockerId}`
            },
            {
              type: "mrkdwn",
              text: `*Reported by:* ${existingBlocker.user_name}`
            },
            {
              type: "mrkdwn",
              text: `*Resolved by:* ${userName}`
            },
            {
              type: "mrkdwn",
              text: `*Resolution Date:* ${resolvedAt.split("T")[0]}`
            }
          ]
        },
        {
          type: "section",
          text: {
            type: "mrkdwn",
            text: `*Resolution Notes:* ${resolutionNotes}`
          }
        }
      ]
    });
  } else {
    await say({
      blocks: [
        {
          type: "section",
          text: {
            type: "mrkdwn",
            text: `❌ *Failed to resolve blocker #${blockerId}.*`
          }
        }
      ]
    });
  }
});

// Call the startApp function to start the app
startApp();
