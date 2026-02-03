const express =require('express');
const https=require('https')
const axios= require('axios');
const { channel } = require('diagnostics_channel');
const app= express();

const PORT = 3000;

// MIDLEWARE
app.use(express.urlencoded({extended:true}));
app.use(express.json());

app.get('/', (req,res)=>{
    res.send('Daily check in bot is working!')
})

app.post("/slack/checkin", async (req, res) => {
    const triggerId = req.body.trigger_id;

  //status code
    res.status(200).send();
  // code to allow user enter her checkin details via a form
    try {
      await axios.post(
        "https://slack.com/api/views.open",
        {
          trigger_id: triggerId,
          view: {
            type: "modal",
            callback_id: "daily_checkin_modal",
            title: {
              type: "plain_text",
              text: "Daily Check-In"
            },
            submit: {
              type: "plain_text",
              text: "Submit"
            },
            close: {
              type: "plain_text",
              text: "Cancel"
            },
            blocks: [
              {
                type: "input",
                block_id: "mood_block",
                label: {
                  type: "plain_text",
                  text: "How are you feeling today?"
                },
                element: {
                  type: "plain_text_input",
                  action_id: "mood_input"
                }
              },
              {
                type: "input",
                block_id: "work_block",
                label: {
                  type: "plain_text",
                  text: "What did you work on today?"
                },
                element: {
                  type: "plain_text_input",
                  multiline: true,
                  action_id: "work_input"
                }
              }
            ]
          }
        },
        {
          headers: {
            Authorization: "Bearer xoxb-10416911706404-10407137247859-FF8r6XJmy9JnaYGGhFTcGOsN",
            "Content-Type": "application/json"
          }
        }
      );
    } catch (error) {
      console.error(
        "Error opening modal:",
        error.response?.data || error.message
      );
    }
  });
  

app.post("/slack/interactions",(req, res)=>{
    const  payload =JSON.parse(req.body.payload);
    console.log("form submitted successifuly")

    if (payload.type === "view_submission") {
        const values = payload.view.state.values;
    
        const mood = values.mood_block.mood_input.value;
        const work = values.work_block.work_input.value;


// code  to display what the user has entered in the form on the  separate channel(aka checkin details)
  const message=  `todays Daily check-in <@${payload.user.id}> Mood:${mood} work:${work}`;
     const postData=JSON.stringify({
        channel:"checkin_details",
        text:message

     });
     const options = {
        hostname: "slack.com",
        path: "/api/chat.postMessage",
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": "Bearer xoxb-10416911706404-10407137247859-FF8r6XJmy9JnaYGGhFTcGOsN"
        }
      };
      
      const request = https.request(options, (response) => {
        response.on("data", () => {});
      });
      
      request.write(postData);
      request.end(); 
    res.status(200).json({ response_action: "clear" });
    }   
})


app.listen(PORT, ()=>{
    console.log("server listening to port "+ PORT)
})