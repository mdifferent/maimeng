var mongoose = require('mongoose')
    , mongoosastic = require('mongoosastic')
    , Schema = mongoose.Schema

mongoose.connect('mongodb://10.58.121.253:27017/test')

var bookSchema = new Schema({
    name: { type: String, es_indexed: true },
    author: String,
    lang: String
})

bookSchema.plugin(mongoosastic, {
    index: 'books',
    type: 'bookname',
    bulk: {
        size: 10, // preferred number of docs to bulk index
        delay: 1000 //milliseconds to wait for enough docs to meet size constraint
    },
    hosts: ['10.58.121.253:9200'],
    hydrate: true,
    hydrateOptions: {
        lean: true
    }
})

var Book = mongoose.model('books', bookSchema)

Book.createMapping({
    index: 'books',
    type: 'bookname',
    body: {
        properties: {
            name: {
                type: 'string',
                analyzer: 'ik_syno_smart',
                search_analyzer: 'ik_syno_smart'
            }
        }
    }
}, function (err, mapping) {
    if (err) {
        console.error('error creating mapping (you can safely ignore this)');
        console.error(err);
    } else {
        console.info('mapping created!');
        console.info(mapping);
    }
})


var operation = function () {
    var book = new Book({
        name: 'Node.js in Action',
        author: 'Tom',
        lang: 'EN'
    })
    Book.create(book, function (err, res) {
        if (err)
            console.error(err);
        book.on('es-indexed', function (err, res) {
            if (err) console.error(err);
            else if (res) console.log(res)
            else console.log('No result')
        });
    })
}

setInterval(operation, 5000)


