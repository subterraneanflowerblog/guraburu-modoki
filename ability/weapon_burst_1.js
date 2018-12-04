function execute(room, playerId, characterIndex, targetIndex) {
  const character = room.getPlayerById(playerId).members[characterIndex];
  character.charge = 100;
  return [{
    type: 'chargeup',
    characterIndices: [characterIndex]
  }];
}

module.exports = {
  execute
};