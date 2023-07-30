const { ObjectId } = require('mongodb');

var id = new ObjectId('64aa26b58ceb9a34a209fad2');

var imageTemplate = {
  title: 'Image',
  description:
    'Oil and gas are essential natural resources that play a pivotal role in the global energy sector. These hydrocarbons, formed over millions of years from organic matter, are extracted from deep within the Earth is crust through drilling processes. Once extracted, oil and gas are refined into various products such as gasoline, diesel, and petrochemicals, which are integral to transportation, manufacturing, and everyday life. Despite their widespread use, concerns about environmental impacts and climate change have led to a growing focus on renewable energy sources as alternatives. Nevertheless, oil and gas remain crucial components of the energy mix, shaping economies and influencing geopolitics worldwide. Efforts to balance energy needs with sustainability will continue to drive innovation and transition towards cleaner technologies in the oil and gas industry.',
  seller: id,
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
  image.imageLocation = image.tags[0].replace(/ /g, '-') + '.jpeg';
  image.watermarkedLocation = image.tags[0].replace(/ /g, '-') + '.jpeg';

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
