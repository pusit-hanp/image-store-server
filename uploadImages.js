var imageTemplate = {
  title: 'Image',
  description:
    'Xenoblade Chronicles 2 is an epic role-playing game that takes players on a thrilling adventure in the world of Alrest. With its vast open landscapes, diverse cast of characters, and captivating storyline, this game offers a truly immersive experience. Players assume the role of Rex, a young salvager who embarks on a quest to find the mythical paradise known as Elysium. Along the way, they encounter powerful enemies, forge alliances with different factions, and uncover the secrets of the Cloud Sea. With its deep combat system, breathtaking visuals, and emotionally charged soundtrack, Xenoblade Chronicles 2 delivers an unforgettable gaming experience. Whether you are a fan of the series or new to the franchise, this game is sure to captivate you for hours on end.',
  seller: 12345678,
  views: 500,
  status: 'Active',
  imageLocation: './images/raw/test.jpg',
  dateCreated: new Date(),
  dateEdited: new Date(),
};

var tags = [
  'Exploration and Production',
  'Refining and Processing',
  'Transportation and Distribution',
  'Renewable Energy and Sustainability',
  'Economics and Markets',
  'Health, Safety, and Environment (HSE)',
  'Technology and Innovation',
];

var images = [];

function getRandomPrice(min, max) {
  return (Math.random() * (max - min) + min).toFixed(2);
}

for (var i = 1; i <= 99; i++) {
  var image = Object.assign({}, imageTemplate);
  image.title += ' ' + i;
  image.description = image.description;
  image.imageLocation = './images/raw/test.jpg';
  image.tags = getRandomTags(tags, 2);
  image.price = getRandomPrice(0.99, 20);
  images.push(image);
}

db.images.insertMany(images);

function getRandomTags(tags, count) {
  var randomTags = [];
  while (randomTags.length < count) {
    var tag = tags[Math.floor(Math.random() * tags.length)];
    if (!randomTags.includes(tag)) {
      randomTags.push(tag);
    }
  }
  return randomTags;
}
