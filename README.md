# Slack Bot with Bolt for JavaScript

A Slack bot built using Bolt for JavaScript that provides various functionalities through slash commands. This bot can greet users, manage polls, set reminders, and more.

## Features

- **/hello**: Greets the user with a friendly message. Example: `/hello`
- **/say_name**: Responds with the user's name. Example: `/say_name`
- **/founders**: Provides information about the founders of the organization. Example: `/founders`
- **/help**: Lists all available commands and their descriptions. Example: `/help`
- **/add_numbers**: Adds numbers provided by the user. Example: `/add_numbers 1 2 3`
- **/poll**: Creates a new poll with options. Example: `/poll "What's your favorite color?" "Red" "Blue" "Green"`
- **/closepoll**: Closes an active poll and displays the results. Example: `/closepoll`
- **/coffee**: Schedules a coffee break with a random team member. Example: `/coffee`
- **/remindme**: Sets one-time or recurring reminders. Example: `/remindme "Meeting with team" "Today at 3 PM"`
- **/listreminders**: Lists all active reminders for the user. Example: `/listreminders`
- **/cancelme**: Cancels a specific reminder. Example: `/cancelme`
- **/decision**: Decision log for the team. Example: `/decision "Decided to use Node.js for backend" "Faster development and large community support"`

## Tech Stack

- **Node.js**: JavaScript runtime environment.
- **Bolt for JavaScript**: Framework for building Slack apps.
- **Slack API**: For interacting with Slack workspace.

## Setup Instructions

1. **Clone the repository**:

   ```bash
   git clone

   cd SLACK-BOT
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```
3. **Create a Slack App**:
   - Go to the [Slack API](https://api.slack.com/apps) and create a new app.
   - Enable the necessary permissions for your bot.
   - Install the app to your workspace and get the Bot User OAuth Token.
4. **Set up environment variables**:
   - Create a `.env` file in the root directory.
   - Add the following variables:
     ```env
     SLACK_BOT_TOKEN=your-bot-user-oauth-token
     SLACK_SIGNING_SECRET=your-signing-secret
     PORT=3000
     ```

## How to Run Locally

1. **Start the bot**:
   ```bash
   npm run dev
   ```
2. **Interact with the bot**:
   - Use the slash commands in your Slack workspace to interact with the bot.
