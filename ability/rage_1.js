function execute(room, playerId, characterIndex, targetIndex) {
  const members = room.getPlayerById(playerId).members;
  members.forEach((character, index) => {
    room.addStatusToCharacter(playerId, index, { icon: '💪', remainTurns: 3, attackMultiplier: 1.1 });
  });

  return [{
    type: 'attackup',
    characterIndices: members.map((c, index) => index)
  }];
}

module.exports = {
  execute
};