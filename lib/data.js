const MongoClient = require('mongodb').MongoClient;
const ObjectID = require('mongodb').ObjectID;

// MongoDBとの接続
const connectMongoClient = MongoClient.connect('mongodb://localhost:27017');

// クエストIDからエネミーグループを取得する関数
async function findEnemyGroupByQuestId(questId) {
  const client = await connectMongoClient;
  const db = client.db('guraburu');

  const questCollection = db.collection('quest');
  const quest = await questCollection.findOne({ _id: new ObjectID(questId)});

  const enemyGroupCollection = db.collection('enemyGroup');
  const enemyGroup = await enemyGroupCollection.findOne({ _id: quest.enemyGroupId });

  return enemyGroup;
}

// パーティのデータ内にあるジョブ名やアビリティIDなどを、
// ただのIDから実際のデータに置き換える関数
async function resolvePlayerPartyData(user, party) {
  const client = await connectMongoClient;
  const db = client.db('guraburu');

  const jobCollection = db.collection('job');
  const abilityCollection = db.collection('ability');
  const characterCollection = db.collection('character');

  const playerJob = await jobCollection.findOne({ name: party.player.job });

  const playerAbilityIds = [...playerJob.abilities, ...party.player.exAbilities];
  const playerAbilities = await Promise.all(playerAbilityIds.map((id) => abilityCollection.findOne({_id: id})));

  const playerData = {
    name: user.name,
    graphic: playerJob.graphic,
    abilities: playerAbilities,
    hp: 8000,
    currentHp: 8000,
    attack: 9000,
    charge: 0,
    status: []
  };

  const memberData = await Promise.all(party.members.map( (id) => characterCollection.findOne({_id: id})));
  const resolvedMemberData = await Promise.all(memberData.map(async (c) => {
    c.abilities = await Promise.all(c.abilities.map((id) => abilityCollection.findOne({_id: id})));
    c.abilities = c.abilities.map((a) => { a.recast = 0; return a; });
    c.currentHp = c.hp;
    c.charge = 0;
    c.status = [];
    return c;
  }));

  const battleParty = {
    _id: user._id,
    playerName: user.name,
    members: [playerData, ...resolvedMemberData]
  };

  return battleParty;
}

module.exports = {
  connectMongoClient,
  findEnemyGroupByQuestId,
  resolvePlayerPartyData
};