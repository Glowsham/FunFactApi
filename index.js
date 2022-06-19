const express = require('express');
const app = express();
const jwt = require('jsonwebtoken');

const bodyParser = require('body-parser');
app.use(bodyParser.json());

const cors = require('cors');
app.use(cors({
    origin: ['https://web.postman.co', 'https://yngdf9.csb.app', 'https://fun-fact.vercel.app'],
    optionsSuccessStatus: 200
}));

const mongoose = require('mongoose');
const Collection = require('./database/collection');
const Subject = require('./database/subject');
const Notion = require('./database/notion');
const Note = require('./database/note');
mongoose.connect(process.env.DBTOKEN, { useNewUrlParser: true, useUnifiedTopology: true });

const auth = (req, res, next) => {
	if (req.params.pageType !== 'home' && req.params.pageType !== 'subjDetails' && req.params.pageType !== 'notionDetails')
	return res.status(404).json({
		message: 'Invalid form: no such page type.'
	});

	try {
		const tokenData = jwt.verify(req.headers.authorization, 'my super secret key lol');
		req.database = req.params.pageType === 'home' ? Subject : req.params.pageType === 'subjDetails' ? Notion : Note;
		req.elDatabase = req.params.pageType === 'home' ? Collection : req.params.pageType === 'subjDetails' ? Subject : Notion;
		req.elementId = req.params.pageType === 'home' ? tokenData.id : req.params.elementId;
		return next();
	} catch {
		return res.status(401).json({
			message: 'Invalid request: incorrect token.'
		});
	}
};

app.post('/api/login', (req, res) => {
	if (!req.body.password) return res.status(401).json({
		message: 'Invalid request: invalid form.'
	});

	Collection.findOne({ password: req.body.password }).then((collection) => {
		if (!collection) return res.status(401).json({
			message: 'Wrong password!'
		});
		res.json({
			token: jwt.sign({ id: collection._id }, 'my super secret key lol')
		});
	});
});

app.get('/api/fetch/:pageType/:elementId?', auth, (req, res) => {
	if (
		(req.params.pageType === 'home' && req.params.elementId) ||
		(req.params.pageType !== 'home' && !req.params.elementId)
	) return res.status(401).json({
		message: 'Invalid request: invalid form.'
	});

	if (req.params.pageType === 'home') {
		req.database.find({ elementId: req.elementId }).sort('-position').select('-elementId -position -__v').exec((e, items) => {
			res.json({
				message: 'Welcome to the Fun Fact app!',
				items
			});
		});
	} else {
		req.elDatabase.findOne({ _id: req.elementId }).select('-elementId -position -password -__v').exec((e, element) => {
			if (!element) return res.status(404).json({
				message: 'Invalid request: specified element does not exists.'
			});
	
			req.database.find({ elementId: req.elementId }).sort('-position').select('-elementId -position -__v').exec((e, items) => {
				res.json({
					message: 'Welcome to the Fun Fact app!',
					element,
					items
				});
			});
		});
	}
});

app.post('/api/create/:pageType/:elementId?', auth, (req, res) => {
	if (
		(req.params.pageType === 'notionDetails' && (!req.body.short || !req.body.full || !req.params.elementId)) ||
		(req.params.pageType === 'subjDetails' && (!req.body.title || !req.params.elementId)) ||
		(req.params.pageType === 'home' && (!req.body.title || req.params.elementId))
	) return res.status(401).json({
		message: 'Invalid request: invalid form.'
	});

	req.elDatabase.findOne({ _id: req.elementId }).then((element) => {
		if (!element) return res.status(403).json({
			message: 'Invalid request: specified element does not exists.'
		});

		req.database.countDocuments({ elementId: req.elementId }, (e, count) => {
			new req.database({
				title: req.body.title,
				content: {
					short: req.body.short,
					full: req.body.full
				},
				elementId: req.elementId,
				position: count
			}).save((e, item) => {
				res.send({
					message: 'Your new item has been saved!',
					item
				});
			});
		});
	});
});

app.put('/api/edit/:pageType/:itemId', auth, (req, res) => {
	if (
		(req.params.pageType === 'notionDetails' && (!req.body.short || !req.body.full)) ||
		(req.params.pageType !== 'notionDetails' && (!req.body.title))
	) return res.status(401).json({
		message: 'Invalid request: invalid form.'
	});

	req.database.findOne({ _id: req.params.itemId }).then((item) => {
		if (!item) return res.status(403).json({
			message: 'Invalid request: specified item does not exists.'
		});

		if (req.params.pageType === 'notionDetails') {
			item.content.short = req.body.short;
			item.content.full = req.body.full;
		} else {
			item.title = req.body.title;
		}
		item.save((e, item) => {
			res.send({
				item
			});
		});
	});
});

app.patch('/api/move/:pageType/:itemId', auth, (req, res) => {
	if (!req.body.newElement) return res.status(401).json({
		message: 'Invalid request: invalid form.'
	});

	req.database.findOne({ _id: req.params.itemId }).then((item) => {
		if (!item) return res.status(403).json({
			message: 'Invalid request: specified item does not exists.'
		});

		req.elDatabase.findOne({ title: req.body.newElement }).then((element) => {
			if (!element) return res.status(403).json({
				message: 'Invalid request: specified element does not exists.'
			});

			item.elementId = element.id;
			item.save();
			res.json({
				message: 'The item has been moved!',
				item
			});
		});
	});
});

app.patch('/api/organize/:pageType/:itemId', auth, (req, res) => {
	if (!req.body.newPosition && req.body.newPosition !== 0) return res.status(401).json({
		message: 'Invalid request: invalid form.'
	});

	req.database.findOne({ _id: req.params.itemId }).then((item) => {
		if (!item) return res.status(401).json({
			message: 'Invalid request: specified item does not exists.'
		});

		req.database.find({ elementId: item.elementId }).sort('-position').exec((e, items) => {
			if (req.body.newPosition < 0 || req.body.newPosition >= items.length) return res.status(401).json({
				message: 'Invalid request: invalid new position.'
			});

			var positions = items.map((i) => i.id);
			positions.splice(positions.indexOf(item._id.toString()), 1);
			positions.splice(req.body.newPosition, 0, item._id);

			positions.reverse().forEach((iid, index) => {
				items.find((i) => i._id == iid.toString()).position = index;
				items.find((i) => i._id == iid.toString()).save();
			});
			res.json({
				message: 'The item\'s position has been changed!'
			});
		});
	});

	/*if (!req.body.newOrder || !Array.isArray(req.body.newOrder)) return res.status(401).json({
		message: 'Invalid request: invalid form.'
	});

	req.database.find({ elementId: req.elementId }).then((items) => {
		if (!req.body.newOrder || req.body.newOrder.length !== items.length || !items.every((item) => req.body.newOrder.find(i =>  i == item._id))) return res.status(401).json({
			message: 'Invalid request: incomplete list of items.'
		});

		req.body.newOrder.reverse().forEach((itemId, index) => {
			items.find(i => i.id === itemId).position = parseInt(index);
			items.find(i => i.id === itemId).save();
		});
		res.json({
			message: 'The items have been reorganized!'
		});
	});*/
});

app.delete('/api/delete/:pageType/:itemId', auth, (req, res) => {
	req.database.findOne({ _id: req.params.itemId }).then((item) => {
		if (!item) return res.status(403).json({
			message: 'Invalid request: specified item does not exists.'
		});

		item.delete();
		res.json({
			message: 'The item has been deleted!'
		});
	});
});

app.get('/getAll', (req, res) => {
	Note.find({}).then((collections) => {
		res.json({
			collections
		});
	});
});

app.listen(process.env.PORT || 5000, () => {
	console.log(`Fun Fact backend is running!`);
});

/*const sign = (req, res, next) => {
	if (req.headers.authorization) {
		try {
			jwt.verify(req.headers.authorization, 'my super secret key lol');
			req.database = req.params.pageType === 'home' ? Subject : req.params.pageType === 'subjDetails' ? Notion : Note;
			return next();
		} catch {
			return res.status(401).json({
				error: 'invalidToken'
			});
		}
	} else {
		return res.status(401).json({
			error: 'noToken'
		});
	}
};

app.get('/fetch/:pageType/:elementId?', sign, (req, res) => {
	const token = jwt.sign({ password: 'spaghetti' }, 'my super secret key lol', { expiresIn: "2h" });
	res.json({
		token
	});

	var database = req.params.pageType === 'home' ? Subject : req.params.pageType === 'subjDetails' ? Notion : Note;
	database.find({elementId: req.params.elementId}).then((items) => {
		res.json({
			content: items.map(({ _id: id, ...rest }) => ({ id, ...rest }))
		});
	});
});

app.get('/token', sign, (req, res) => {
	res.json({
		password: 'tokenDecoded.password'
	});
}); */