#!/usr/bin/env node

var bezier = require('turf-bezier');
var MapboxClient = require('mapbox');
var mapbox = new MapboxClient(process.env.MAPBOX_ACCESS_TOKEN);
var argv = require('minimist')(process.argv.slice(2));
var upload = require('mapbox-upload');
var randomstring = require('randomstring');
var getUser = require('mapbox/lib/get_user');
var fs = require('fs');
var mktemp = require('mktemp');

var username = getUser(process.env.MAPBOX_ACCESS_TOKEN);

var sourceDataset = argv._[0];
var destTileset = argv._[1];

if (!sourceDataset) {
    console.log('Usage: mapbox-datasets-bezier DATASET_ID [TILESET_ID]');
    process.exit();
}

if (!destTileset) {
    destTileset = username + '.' + randomstring.generate({
        length: 8,
        charset: 'alphanumeric',
        capitalization: 'lowercase'
    });
}

mapbox.readDataset(sourceDataset, function (err, dataset) {
    if (err) {
        console.error(err);
    }
    var curveFeatures = [];
    mapbox.listFeatures(sourceDataset, {limit: 100}, function (err, collection) {
        if (err) {
            console.error(err);
        }
        collection.features.forEach(function (feature) {
            if (feature.geometry.type === 'LineString') {
                var resolution = feature.properties.resolution;
                var sharpness = feature.properties.sharpness;

                var curve = bezier(feature, resolution || 10000, sharpness || 0.85);
                curveFeatures.push(curve);
            }
        });

        var geojson = {
            type: 'FeatureCollection',
            features: curveFeatures
        };

        var path = mktemp.createFileSync('XXXXXXX.geojson');
        fs.writeFileSync(path, JSON.stringify(geojson));

        var uploadProgress = upload({
            file: path,
            account: username,
            accesstoken: process.env.MAPBOX_ACCESS_TOKEN,
            mapid: destTileset,
            name: dataset.name

        });

        uploadProgress.on('error', function (err) {
            if (err) {
                console.error(err);
            }
            fs.unlinkSync(path);
        });
        uploadProgress.once('finished', function () {
            fs.unlinkSync(path);
            console.log('https://www.mapbox.com/studio/tilesets/' + destTileset + '/');
        });
    });
});
