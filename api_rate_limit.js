import { createClient } from 'redis';
import moment from 'moment';

//
const client = createClient({
    url: process.env.REDIS_URL,
    socket: {
      tls: false,
      rejectUnauthorized: false
    }
});
  
client.on('error', (err) => console.log('Redis Client Error', err));

const DURATION_LIMIT_SECONDS = 15;
const ALLOWED_TOKENS = 10;

await client.connect();
 
const api_limit = (req,res,next) => {
        
    if (!client) {
        console.log('No Reddis Client');
        process.exit(1); //check code
    }
    else{

        let time = moment();
       
        client.get(req.ip, (err, reply) => {
            if (err) throw err;

        })
        .then(response => {

            console.log(`RES: ${response} IP: ${req.ip}`);

            if (response === null){
                //User doesn't exists: setup in cache                
                const userInfo = {
                    timeStamp : time.unix(),
                    token: ALLOWED_TOKENS
                }

                client.set(req.ip,JSON.stringify(userInfo));
                return next();
            }
            else{
                //Found User
                //Subtract Bucket OR if duration has passed, refill
                let data = JSON.parse(response);
                console.log(data);
                let newInfo = {
                    timeStamp : time.unix(),
                    token: ALLOWED_TOKENS
                };

                //Check if duration has elapsed
                const elapsedTime = time.unix() - data.timeStamp;
                console.log(`elapsed time ${elapsedTime}`)
                if (elapsedTime > DURATION_LIMIT_SECONDS){
                    //RESET
                    newInfo = {
                        timeStamp : time.unix(),
                        token: ALLOWED_TOKENS
                    }
                }
                //check if token is greater than 1
                else if (data.token <= 0){
                    //res.status(429).jsend.error(`You have exceeded the ${MAX_REQUESTS_ALLOWED} requests in ${DURATION_LIMIT_MINUTE} minute limit!`);
                    return res.status(429).json('Cannot process request: Out of Tokens');
                }
                else {
                    newInfo = {
                        timeStamp : data.timeStamp,
                        token: (data.token - 1)
                    }
                }      
                
                client.set(req.ip,JSON.stringify(newInfo)); 
                return next();
            }
        })
        .catch((err) => {
            console.log(`ERROR: ${err}`)
            next();
        });    
    
    }

}

export default api_limit;
  