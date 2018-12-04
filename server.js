const express = require('express');
const bodyParser = require('body-parser');
const app = express();
const WebSocketServer = require('websocket').server;
const http = require('http');
const passport = require('passport');
const LocalStrategy = require('passport-local').Strategy;
const session = require('express-session');
const crypto = require('crypto');

const { connectMongoClient, findEnemyGroupByQuestId, resolvePlayerPartyData } = require('./lib/data');
const { BattleRoom } = require('./lib/battle');

const battleMap = new Map();

// セッション周りの設定
app.use(session({
  secret: "hihiirokane-takusan-hosii",
  resave: false,
  saveUninitialized: false
}));

// Passportを使ったログイン認証
app.use(passport.initialize());
app.use(passport.session());

passport.use(new LocalStrategy(async (username, password, done) => {
  const client = await connectMongoClient;
  const userCollection = client.db('guraburu').collection('user');
  const user = await userCollection.findOne({ username });

  // パスワードが一致していれば通す
  if(user && user.password === password) {
    delete user.password;
    return done(null, user);
  } else {
    return done(null, false);
  }
}));

passport.serializeUser((user, done) => {
  return done(null, user.username);
});

passport.deserializeUser( async (username, done) => {
  const client = await connectMongoClient;
  const userCollection = client.db('guraburu').collection('user');
  return done(null, await userCollection.findOne({ username }, { password: false }));
});

// 送られてきたjsonをパースできるようにしておく
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

// /loginにアクセスしてきたらログイン画面を返す
app.get('/login', (req, res) => {
  res.sendFile(__dirname + '/web/login.html');
});

// /loginにPOSTしてきたら認証
app.post('/login', passport.authenticate('local', { successRedirect: '/', failureRedirect: '/login' }));

// ここから先は認証が必要
app.use((req, res, next) => {
  if(req.isAuthenticated()) {
    next();
  } else {
    res.redirect('/login')
  }
});

// 「web/private」フォルダを公開
app.use(express.static('web/private'));

// ユーザ情報の取得
// とりあえずIDだけ返す
app.get('/user/authenticated', (req, res) => {
  res.json({ id: req.user._id.toString() });
});

// /quest/listにGETでアクセスしてきたらクエストのリストをJSONで返す
app.get('/quest/list', async (req, res) => {
  const client = await connectMongoClient;
  const questCollection = client.db('guraburu').collection('quest');
  res.json(await questCollection.find({}, { enemyGroupId: false }).toArray());
});

// /quest/startにクエストIDをPOSTするとクエストスタート
app.post('/quest/start', async (req, res) => {
  const questId = req.body.questId;

  const enemyGroup = await findEnemyGroupByQuestId(questId);
  const battleParty = await resolvePlayerPartyData(req.user, req.user.parties[0]);

  const roomId = crypto.randomBytes(16).toString('hex'); // ランダムな部屋ID。この方法だと被る可能性あるので真面目にやる時は別の方法で
  const room = new BattleRoom(enemyGroup.enemies);
  room.joinPlayerParty(battleParty);

  // ルームIDとバトルを紐付け
  battleMap.set(roomId, room);

  res.json({ roomId });
});

// ポート3000で待ち受ける
app.listen(3000, () => console.log('Listening on port 3000'));

// WebSocketサーバを作る
const server = http.createServer();
server.listen(4000, () => console.log('WebSocket listening on port 4000'));
const websocketServer = new WebSocketServer({
  httpServer: server
});

websocketServer.on('request', (request) => {
  // 接続を無条件に受け入れる
  // 本来は認証とか入れないと垢ハックできちゃうからダメだよ！
  // 今回はお遊びだからね
  const connection = request.accept('', request.origin);

  // クライアントからメッセージが届いたとき
  connection.on('message', (message) => {
    const json = JSON.parse(message.utf8Data);
    const room = battleMap.get(json.payload.room);

    // joinメッセージならルームデータを送る
    if(json.command === 'join') {
      connection.sendUTF(JSON.stringify({
        type: 'roomdata',
        payload: {
          playerData: room.getPlayerById(json.payload.playerId),
          roomData: room.roomData
        }
      }));
    }

    if(json.command === 'attack') {
      const animations = room.processTurn(json.payload.playerId, json.payload.enableChargeAttack);

      // たぶん本来は差分結果だけ送って転送量削減とかするんだろうけど
      // 面倒なので全データ送る
      connection.sendUTF(JSON.stringify({
        type: 'turnanimation',
        payload: {
          animations,
          playerData: room.getPlayerById(json.payload.playerId),
          roomData: room.roomData
        }
      }));
    }

    if(json.command === 'useability') {
      const animations = room.useAbility(json.payload.playerId, json.payload.characterIndex, json.payload.abilityIndex);

      connection.sendUTF(JSON.stringify({
        type: 'abilityanimation',
        payload: {
          animations,
          playerData: room.getPlayerById(json.payload.playerId),
          roomData: room.roomData
        }
      }));
    }
  });
});