//dependancies
import bodyparser = require('body-parser')
import path = require('path')
import express = require('express')
import {UserHandler} from './user'
import mongoAccess from './mongoAccess'
import { MetricsHandler } from './metrics'
import jwt from 'jwt-simple'
import moment from 'moment'

const app = express();
const port: string = process.env.PORT || '8080'
const mgAccess: mongoAccess = new mongoAccess("mongodb://localhost:27017/")
const UserHd:UserHandler = new UserHandler(mgAccess)
const MetricHd: MetricsHandler = new MetricsHandler(mgAccess)
//public path for img, js and css
app.use(express.static(path.join(__dirname, '/../public')))
//use bodyparser to parse requests
app.use(bodyparser.json())
app.use(bodyparser.urlencoded())
//views path for response rendering
app.set('views', __dirname + "/../views")
app.set('view engine', 'ejs')
//set the secret string for user authentification
app.set('jwtTokenSecret', 'Kremlevka');

//displayed pages
app.get('/', (req: any, res: any)  =>{
  res.render('index', { name: 'Toto' })
})
app.get('/userPage', (req: any, res: any)  =>{
  res.render('user', { name: 'Toto' })
})
//serverSide requests
app.post('/connectUser', (req: any, res: any)=>{
  
  const {email, password} = req.body
  if(email && password)
  {
    //check if the user is in the db and if his password correct
      UserHd.getUserByMail(email, (err, result) =>{
        if(err) 
          res.status(520).send("Erreur,\n" + err)
        if(!result)
          res.status(404).send("This email does not exist")
        else if(result.getPassword() !== password)
          res.status(409).send("Wrong Password")
        else if (result && result.getPassword() === password)
        {
            res.json(createToken(result));
        }
      })
  }
  else
    res.status(400).send("Specify an email and a password")
})
app.get('/getUsers', (req: any, res: any)  =>{
    UserHd.getUsers((err: Error | null, result: any) => {
    if (err) throw err
    res.json(result)
    //to give the response
    res.end(200)
   })
 })
app.post('/getUserMetrics', (req: any, res: any)  =>{
  if(req.body)
  {
    var {id, token} = req.body
  }
  else
      res.status(400).send("Access denied ")
  try{
    token = checkToken(token, id)
    if(token)
    {
        if(id)
        {
          MetricHd.getUserMetrics(id, (err: Error | null, result: any) => {
            if (err) 
              res.status(520).send(String(err))
            else
              res.json(result)
          })
        }
        else
          res.status(400).send("Specify an id")
    }
    else
      res.status(400).send('Access denied')
  }
  catch(err){
    res.status(403).send(String(err))
  }
 })
app.post('/addUser', (req: any, res: any)=>{
  const {email, password} = req.body
  if(email && password)
    {
      //check in this mail is not already associated to another account
      let checkUser =  new Promise(function (success: any, reject: any){
        UserHd.getUserByMail(email, (err, result) =>{
          if(err) reject(err)
          if(result)
            res.status(409).send("This email is already taken")
          else
            success(true)
        })
      })
      checkUser.then(()=>{
        UserHd.addUser(email, password, (err, result) =>{
          if (err)
            res.status(520).send("Erreur,\n" + err)
          else
          {
            if(result)
            {
              res.json(createToken(result));
            }
          }
        })
      }).catch(error => {res.status(409).send(String(error))})
  }
  else
    res.status(400).send("Specify an email and a password")
})
app.post('/addMetric/', (req: any, res: any)=>{
  if(req.body)
    var {token, user_id, debt_to, amount} = req.body
  if(token)
  {
    try{
      token = checkToken(token, user_id)
      if(token)
      {
        if(user_id && debt_to && amount)
        {
          MetricHd.addMetric(user_id, debt_to, amount, (err) =>{
            if (err) 
              res.status(520).send("Erreur ,\n " + err)
            else
              res.status(200).end()
          })
        }
        else
          res.status(400).send("Specify a reminder and an amount")
      }
    }
    catch(err){
      res.status(403).send(String(err))
    }
  }
  else
      res.status(400).send('Access denied');
})
app.post('/delUser/', (req: any, res: any)=>{
  if(req.body.user)
  {
    const id = req.body.user.id
    var token = req.body.token
    try{
      token = checkToken(token, id)
      if(token)
      {
        if(id){
              //check if the user exist
          let checkUser =  new Promise(function (success: any, reject: any){
            UserHd.getUserById(id, (err, result) =>{
              if(err) reject(err)
              if(result)
                success(true)
              else
                res.status(409).send("This User does not exist")
            })
          })//delete in db
          checkUser.then(()=>{
              UserHd.deleteUser(id, (err) =>{
                if (err)
                  res.status(520).send(String(err))
              })
            })//delete in db
            checkUser.then(()=>{
                UserHd.deleteUser(id, (err) =>{
                  if (err)
                    res.status(520).send(String(err))
                })
                MetricHd.deleteUserMetrics(id, (err) =>{
                  if (err)
                      res.status(520).send(String(err))
                })
                  
                res.status(200).end()
            }).catch(error => {res.status(409).send(String(error))})
          }
          else
            res.status(400).send("Specify an id")
        }
        else
          res.status(400).send('Access denied');
    }
    catch(err){
      res.status(403).send(String(err))
    }
  }
  else
    res.status(403).end()
  

})
app.post('/delMetric/', (req: any, res: any)=>{
  if(req.body)
  {
    var {id, user_id, token} = req.body
  }
  else
    res.status(400).send("Access denied")
    if(token)
    {
      try{
        token = checkToken(token, user_id)
        if(token)
        {
          if(id){
                //check if the Metric exist
            let checkMetric =  new Promise(function (success: any, reject: any){
              MetricHd.getMetric(id, (err, result) =>{
                if(err) reject(err)
                if(result)
                  success(true)
                else
                  res.status(409).send("This Metric does not exist")
              })
            })//Delete in db
            checkMetric.then(()=>{
                MetricHd.deleteMetric(id, (err) =>{
                  if (err) 
                    res.status(520).send(String(err))
                  else
                    res.status(200).end()
                })
            }).catch(error => {res.status(409).send(String(error))})
          }
          else
            res.status(400).send("Specify an id")
        }
      }
      catch(err){
        res.status(403).send(String(err))
      }
    }
    else
      res.status(400).send("Access denied")
  
})
app.post('/upUser/', (req: any, res: any)=>{

  if(req.body.user)
  {
    var {id, email, password} = req.body.user.user
    var token = req.body.user.token
  }
  else
      res.status(400).send("Access denied")
  try{
    token = checkToken(token, id)
    if(token)
    {
      if(id && email && password)
      {
        //check if the user exist
        new Promise(function (success: any, reject: any){
        UserHd.getUserById(id, (err, result) =>{
          if(err) reject(err)
          if(result)
            success(true)
          else
            res.status(409).send("This user does not exist")
          })
        }).then((success):any =>{
          if(success)
          {
            return new Promise((success, reject)=>{
              UserHd.getUserByMail(email, (err, result) =>{
                if(err)
                {
                  res.status(520).send(String(err))
                  success(false)
                }
                else if(result)
                {
                  if(result.id != id)
                  {
                    res.status(409).send("This mail already exists")
                    success(false)
                  }
                  else
                    success(true)
                  
                }
                else
                  success(true)
              })
            })
          }
          //finally update the user
        }).then((success) => {
          if(success)
          {
            UserHd.updateUser(id, email, password, (err, result) =>{
              if (err) 
                res.status(520).send( String(err))
              else if(result)
                res.json(createToken(result))
            })
          }
        }).catch(error => 
          {
            if(error != "stop")
              res.status(409).send(String(error));
          })
      }
      else
        res.status(400).send("Specify a id, email and a password")
  }
  else
    res.end('Access token has expired', 400);
  }
  catch(err){
    res.status(403).send(String(err))
  }
})
app.post('/upMetric/', (req: any, res: any)=>{
  if(req.body)
  {
    var {token, id, user_id, debt_to, amount} = req.body
  }

  if(token)
  {
    try{
      token = checkToken(token, user_id)
      if(token)
      {
        if(id && user_id && debt_to && amount)
        {
          //check if the user exist
          let checkUser =  new Promise(function (success: any, reject: any){
            MetricHd.getMetric(id, (err, result) =>{
              if(err) reject(err)
              if(result)
                success(true)
              else
                res.status(409).send("This Metric does not exist")
              })
          })//update in the db
          checkUser.then(() => {
            MetricHd.updateMetric(id, user_id, debt_to, amount, (err) =>{
              if (err)
                res.status(520).send(String(err))
              else
                res.status(200).end()
            })
          }).catch(error => {res.status(409).send(String(error))})
        }
        else
          res.status(400).send("Specify an id, user_id, debt_to and an amount")
        }
      }
      catch(err){
        res.status(403).send(String(err))
      }
    }
    else
      res.status(400).send("Access denied")
  
  })
let server = app.listen(port, (err: Error) => {
  if (err) throw err
  console.log(`Server is running on http://localhost:${port}`)
})
function createToken(result: any):any{
  var expires = moment().add(1, 'h').valueOf();
  var token = jwt.encode({
    iss: result.id,
    exp: expires
  }, app.get('jwtTokenSecret'));
  return({
    token : token,
    expires: expires,
    user: result
  });
}
function checkToken(token: any, id: String): boolean | never{
  if(token)
  {
    try {
      var decoded = jwt.decode(token, app.get('jwtTokenSecret'))

      if (decoded.exp <= Date.now())
        throw new Error("Access token has expired")
      else if(decoded.iss != id)
        throw new Error("Access denied, token does not correspond to this account")
      else
        return true
    } catch (err) {
      throw err
    }
  }
  else
    throw new Error("Access denied without a token")
  
}

export {app, server}
