const MongoClient = require('mongodb').MongoClient;

MongoClient.connect('mongodb://localhost:27017/', async (err, client) => {
  if(err) {
    console.error('MongoDBに何か問題があるようです…');
    console.error(err);
    return;
  }

  // guraburuというデータベースに接続
  const db = client.db('guraburu');

  const abilityCollection = db.collection('ability');

  await abilityCollection.deleteMany({});

  const { insertedIds: abilityIds } = await abilityCollection.insertMany([
    {
      name: 'ウェポンバースト',
      type: 'buff',
      icon: '⚔️',
      recastTurn: 5,
      script: 'weapon_burst_1'
    },
    {
      name: 'レイジ',
      type: 'buff',
      icon: '💪',
      recastTurn: 5,
      script: 'rage_1'
    },
    {
      name: 'アーマーブレイク',
      type: 'attack',
      icon: '🛡',
      recastTurn: 5,
      script: 'armor_break_1'
    }
  ]);

  // ジョブ登録
  const jobCollection = db.collection('job');

  await jobCollection.deleteMany({});

  await jobCollection.insertOne({
    name: 'ファイター',
    graphic: '👩️‍',
    abilities: [
      abilityIds[0],
      abilityIds[1]
    ]
  });

  // キャラクター登録
  const characterCollection = db.collection('character');

  await characterCollection.deleteMany({});

  const { insertedIds: characterIds } = await characterCollection.insertMany([
    {
      name: 'シェロカルテ',
      graphic: '👧',
      type: '火',
      hp: 7000,
      attack: 8000,
      weapon: '剣',
      abilities: [
        abilityIds[2]
      ]
    }
  ]);

  // ユーザ登録
  const userCollection = db.collection('user');

  await userCollection.deleteMany({});

  await userCollection.insertOne({
    username: 'user',
    password: 'user', // 本当はパスワードを平文で保存しちゃダメだよ！ハッシュ化とかしてね
    name: 'ジータ',
    rank: 50,
    parties: [
      {
        name: '編成1',
        player: {
          job: 'ファイター',
          exAbilities: [abilityIds[2]]
        },
        members: [characterIds[0]]
      }
    ]
  });

  // エネミーグループ登録
  const enemyGroupCollection = db.collection('enemyGroup');

  await enemyGroupCollection.deleteMany({});

  const { insertedIds: enemyGroupIds } = await enemyGroupCollection.insertMany([
    {
      enemies: [
        {
          name: 'ゴリラ',
          graphic: '🦍',
          type: '土',
          hp: 1000000,
          attack: 80,
          ct: 3,
          overdriveDamage: 500000,
          breakDamage: 100000
        }
      ]
    },
    {
      enemies: [
        {
          name: 'カツウォヌス',
          type: '水',
          graphic: '🐟',
          hp: 2000000,
          attack: 50,
          ct: 2,
          overdriveDamage: 500000,
          breakDamage: 100000
        }
      ]
    }
  ]);

  // クエスト登録
  const questCollection = db.collection('quest');

  await questCollection.deleteMany({});

  await questCollection.insertMany([
    {
      title: 'ゴリラ Normal',
      enemyGroupId: enemyGroupIds[0]
    },
    {
      title: 'カツウォヌス Extreme',
      enemyGroupId: enemyGroupIds[1]
    }
  ]);

  client.close();
});