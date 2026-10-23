"use strict";
const {createServer}=require("node:http");
const {createHandler}=require("./handler.cjs");
let verifyAppCheck=null;
if(process.env.FIREBASE_PROJECT_ID){
  const {initializeApp}=require("firebase-admin/app");
  const {getAppCheck}=require("firebase-admin/app-check");
  const app=initializeApp({projectId:process.env.FIREBASE_PROJECT_ID});
  verifyAppCheck=(token)=>getAppCheck(app).verifyToken(token);
}
const handler=createHandler({verifyAppCheck,apiKey:process.env.GEMINI_API_KEY,model:process.env.GEMINI_MODEL||"gemini-3.5-flash-lite"});
createServer(handler).listen(Number(process.env.PORT||8080),"0.0.0.0",()=>console.log("MoneyMap AI backend started"));
