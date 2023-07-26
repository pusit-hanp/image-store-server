var imageTemplate = {
  title: 'Image',
  description: 'test description',
  seller: 12345678,
  likes: 0,
  views: 500,
  status: 'Active',
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

for (var i = 1; i <= 40; i++) {
  var image = Object.assign({}, imageTemplate);
  image.title += ' ' + i;
  image.description = image.description;
  image.tags = getRandomTags(tags, 1);
  image.price = getRandomPrice(0.99, 20);

  // Update imageLocation based on the tag value
  image.imageLocation = image.tags[0] + '.jpeg';
  image.watermarkedLocation = image.tags[0] + '.jpeg';

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
