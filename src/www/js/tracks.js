/*
Copyright (c) 2015, EDINA
All rights reserved.

Redistribution and use in source and binary forms, with or without modification,
are permitted provided that the following conditions are met:

* Redistributions of source code must retain the above copyright notice, this
  list of conditions and the following disclaimer.
* Redistributions in binary form must reproduce the above copyright notice, this
  list of conditions and the following disclaimer in the documentation and/or
  other materials provided with the distribution.
* Neither the name of EDINA nor the names of its contributors may be used to
  endorse or promote products derived from this software without specific prior
  written permission.

THIS SOFTWARE IS PROVIDED BY EDINA ''AS IS'' AND ANY EXPRESS OR IMPLIED
WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED WARRANTIES OF
MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE DISCLAIMED. IN NO EVENT
SHALL EDINA BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY,
OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF
SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS
INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT,
STRICT LIABILITY, OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY
OUT OF THE USE OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH
DAMAGE.
*/

"use strict";

/* global XMLSerializer, OpenLayers */

define(['map', 'records', 'utils', 'file'], function(// jshint ignore:line
    map, records, utils, file){

    var GPS_ACCURACY = 50;
    var GPS_AUTO_SAVE_THRESHOLD = 5;
    var GPS_ACCURACY_FLAG = false;

    var debugGPS = false;
    var gpsLastRecorded;
    var gpsReceiveCount = 0;
    var gpsTrackWatchID;

    // add new layer for real-time tracks
    var gpsTrackLayer = map.addLayer({
        id: 'gpsTrack',
        style:{
            colour: 'red',
            strokeWidth: 5
        },
        visible: false
    });

    // create new style for tracks
    map.addRecordStyle({
        type: 'track',
        image: 'css/images/routemarker.png'
    });

    // listen for clicks on tracks
    map.addRecordClickListener(function(feature){
        var isTrack = false;
        if(feature.attributes.type === 'track'){
            isTrack = true;
            showGPSTrack(feature.attributes.id,
                         records.getSavedRecord(feature.attributes.id));
        }

        return isTrack;
    });


    // Suscribe to the map notification for doing some tear down tasks.
    map.on(map.EVT_BEFORE_EXIT,function(){
        _this.gpsCaptureComplete();
    });

    /**
     * Save current GPS position to GPX doc. Periodically auto save the doc to file.
     * @param position Contains position coordinates and timestamp, created by the
     * geolocation API.
     */
    var gpsCaptureAutoSave = function(position){
        var trkseg = _this.currentTrack.doc.getElementsByTagName('trkseg')[0];
        var trkpt = _this.currentTrack.doc.createElement('trkpt');

        trkpt.setAttribute('lat', parseFloat(position.coords.latitude).toFixed(6));
        trkpt.setAttribute('lon', parseFloat(position.coords.longitude).toFixed(6));

        var ele = _this.currentTrack.doc.createElement('ele');
        ele.appendChild(_this.currentTrack.doc.createTextNode(position.coords.altitude));
        trkpt.appendChild(ele);

        var time = _this.currentTrack.doc.createElement('time');

        time.appendChild(_this.currentTrack.doc.createTextNode(
            utils.isoDate(new Date(position.timestamp))));
        trkpt.appendChild(time);
        trkseg.appendChild(trkpt);

        ++gpsReceiveCount;

        if(gpsReceiveCount === GPS_AUTO_SAVE_THRESHOLD){
            gpsCaptureSave();
            gpsReceiveCount = 0;
        }
    };

    /**
     * Save current track as a GPX file.
     * @param callback Function executed after a sucessful save.
     */
    var gpsCaptureSave = function(callback){
        var sXML = new XMLSerializer().serializeToString(_this.currentTrack.doc);

        var assetsDir = records.getAssetsDir(_this.TRACK_TYPE_NAME);
        if(assetsDir){
            var fileName = _this.currentTrack.file;
            assetsDir.getFile(
                fileName,
                {create: true, exclusive: false},
                function(fileEntry){
                    fileEntry.createWriter(
                        function(writer){
                            writer.onwrite = function(evt) {
                                console.debug('GPX file ' + fileName + ' written to ' + assetsDir.fullPath);
                            };
                            writer.write(sXML);

                            if(typeof callback === 'function'){
                                callback();
                            }
                        },
                        function(error){
                            console.error("Failed to write to gpx file:" + fileName + ". errcode = " + error.code);
                        });
                },
                function(error){
                    console.error("Failed to create gpx file: " + fileName + ". errcode = " + error.code);
                }
            );
        }
    };

    /**
     * @return Start position of current GPS track.
     */
    var getGpsTrackStart = function(){
        var coords;
        var track = gpsTrackLayer.features[0];

        if(track !== undefined){
            var features = track.geometry.components;
            if(features.length > 0){
                coords = [
                    features[0].x,
                    features[0].y,
                ];
            }
            else{
                console.debug("No components in geometry");
            }
        }
        else{
            console.debug("No track defined");
        }

        return coords;
    };

    /**
     * Draw GPS track on map.
     * @param interval Time gap between updates. Must be more than 0.
     * @param callback Function to be executed on each good GPS coordinate, taking
     * into account the interval.
     * @param debug Use dummy GPS tracking.
     */
    var gpsTrackOnMap = function(interval, callback, debug){
        debugGPS = debug;
        map.hideRecordsLayer();

        if(!gpsLastRecorded){
            gpsLastRecorded = new Date();
        }

        gpsTrackLayer.setVisibility(true);
        gpsTrackLayer.style.strokeColor = localStorage.getItem(_this.COLOUR_INDEX);
        map.getLocateLayer().setVisibility(false);

        if(gpsTrackLayer.features.length === 0){
            var line = new OpenLayers.Geometry.LineString([]);
            gpsTrackLayer.addFeatures([new OpenLayers.Feature.Vector(line)]);
        }

        // found location
        var onSuccess = function(position){
            var next = new Date(gpsLastRecorded.getTime() + interval);
            var timestamp = position.timestamp;

            if(typeof(timestamp) === 'number'){
                timestamp = new Date(timestamp);
            }

            if((position.coords.accuracy < GPS_ACCURACY) && timestamp > next){
                gpsLastRecorded = timestamp;

                var lonLat = map.toInternal(
                    new OpenLayers.LonLat(
                        position.coords.longitude,
                        position.coords.latitude)
                );

                var point = new OpenLayers.Geometry.Point(lonLat.lon, lonLat.lat);
                gpsTrackLayer.features[0].geometry.addPoint(point);

                // only redraw if map page is active
                if($.mobile.activePage.attr('id') === 'gpscapture-page' ||
                   $.mobile.activePage.attr('id') === 'map-page'){
                    gpsTrackLayer.redraw();
                }

                console.debug("add point: " + position.coords.longitude + ' ' +
                              position.coords.latitude);
                callback(position);
            }
            else{
                console.debug("ignore point: " + position.coords.accuracy);
                console.debug(timestamp + " : " + next);
            }
        };

        // timeout has been reached
        var onError = function(position){
            utils.inform('Waiting for GPS signal');
        };

        // clear watch if already defined
        _this.gpsTrackPause();

        if(debugGPS){
            // for testing
            console.debug("GPS track debug mode");

            var lon = -3.188889;
            var lat = 55.936;

            var points = gpsTrackLayer.features[0].geometry.components;
            if(points.length > 0){
                // use last records point
                var coords = map.toExternal(points[points.length - 1]);

                lon = coords.x;
                lat = coords.y;
            }

            gpsTrackWatchID = setInterval(function(){
                var now = new Date();
                var position = {
                    'coords': {
                        'longitude': lon += Math.random() / 10000,
                        'latitude': lat += Math.random() / 10000,
                        'altitude': Math.random() * 100,
                        'accuracy': Math.random() * 100
                    },
                    'timestamp': now.getTime()
                };
                onSuccess(position);
            }, 1000);
        }
        else{
            gpsTrackWatchID = navigator.geolocation.watchPosition(
                onSuccess,
                onError,
                {
                    enableHighAccuracy: map.GPS_ACCURACY_FLAG,
                    maximumAge: map.GPS_LOCATE_TTL,
                    timeout: map.GPS_LOCATE_TIMEOUT,
                }
            );
        }
    };

    /**
     * hide a single track.
     * @param id Annotation id.
     **/
    var hideGPSTrack = function(id){
        // prepend layer name with gps-track
        var name = "gps-track-" + id;

        var layer = map.getLayer(name);
        if(layer){
            map.removeLayer(layer);
        }

    };

    /**
     * Display a single GPS Track.
     * @param id Annotation id.
     * @param track Annotation object.
     * @param callback Function executed when track has been displayed.
     */
    var showGPSTrack = function(id, track, callback){
        // prepend layer name with gps-track
        var name = "gps-track-" + id;
        var layer = map.getLayer(name);
        if(layer){
            // its possible for different tracks to have the same name so remove
            // layer existing layer and replace it with current
            map.removeLayer(layer);
        }

        // TODO:
        // track URL found in the second element of the fields array in the
        // record, this may not always be the case
        var trackField = track.record.properties.fields[1];

        var colour = 'red';
        if(typeof(trackField.style) !== 'undefined'){
            colour = trackField.style.strokeColor;
        }

        // create layer with the GPX track
        var gpxLayer = map.addGPXLayer({
            id: name,
            style:{
                colour: colour,
            },
            url: trackField.val
        });

        gpxLayer.setVisibility(true);
        gpxLayer.events.register("loadend", this, function() {
            var extent = gpxLayer.getDataExtent();
            if(extent !== null){
                map.zoomToExtent(extent);
                if(callback){
                    callback();
                }
            }
        });
    };

    /************************** public interface  ******************************/

var _this = {

    COLOUR_INDEX: 'gps-track-color',
    TRACK_TYPE_NAME: 'track',

    /**
     * Start GPX track.
     * @param annotation Annotation metadata object
     * @param debug Use dummy GPS tracking.
     */
    gpsTrack: function(annotation, debug){
        if(!this.currentTrack){
            var now = utils.isoDate();
            var fileName  = (now + '.gpx').replace(/\s|:/g, '_');
            var fullName;

            var assetsDir = records.getAssetsDir(this.TRACK_TYPE_NAME);

            if(assetsDir){
                fullName = file.getFilePath(assetsDir) + fileName;
            }

            // initialise record point with user's current location
            var start = map.getUserCoords();
            annotation.record.geometry.coordinates = [
                start.lon,
                start.lat,
                start.gpsPosition.altitude
            ];

            annotation.record.properties.fields[1].val = fullName;
            var id = records.saveAnnotation(undefined, annotation);

            // create XML doc first using jquery's parseXML function,
            // then use standard dom methods for building the XML
            var doc = $.parseXML('<?xml version="1.0" encoding="UTF-8"?><gpx></gpx>');
            var gpx = doc.getElementsByTagName('gpx')[0];
            gpx.setAttribute('xmlns', 'http://www.topografix.com/GPX/1/1');
            gpx.setAttribute('version', '1.1');
            gpx.setAttribute('creator', 'fieldtripGB');

            // create metadata header
            var meta = doc.createElement('metadata');
            var time = doc.createElement('time');
            time.appendChild(doc.createTextNode(now));
            meta.appendChild(time);
            doc.documentElement.appendChild(meta);

            var trk = doc.createElement('trk');
            var trkseg = doc.createElement('trkseg');
            trk.appendChild(trkseg);

            doc.documentElement.appendChild(trk);

            this.currentTrack = {
                'id': id,
                'file': fileName,
                'doc': doc
            };

            // kick off tracking
            this.gpsTrackPlay(annotation.rate, debug);
        }
    },

    /**
     * Complete current GPS capture.
     * @param callback Function executed when capture is complete.
     */
    gpsCaptureComplete: function(callback){
        if(typeof(this.currentTrack) !== 'undefined'){
            var annotation = records.getSavedRecord(this.currentTrack.id);
            this.gpsTrackPause();

            // populate record with start location
            var startPoint = getGpsTrackStart();

            if(startPoint !== undefined){
                annotation.record.geometry.coordinates = startPoint;
                // save the annotation to local storage
                records.saveAnnotation(this.currentTrack.id, annotation);

                var id = this.currentTrack.id;

                // save the GPX file
                gpsCaptureSave(function(){
                    // removing all annotation will force a refresh
                    map.getRecordsLayer().removeAllFeatures();

                    // display saved track on map
                    showGPSTrack(id, annotation, callback);
                });
            }
            else{
                console.debug('Track ' + this.currentTrack.title +
                              ' has no points');
                records.deleteAnnotation(this.currentTrack.id);
            }

            this.gpsTrackStop();
            this.currentTrack = undefined;
        }
    },

    /**
     * Discard current GPS capture.
     */
    gpsCaptureDiscard: function(){
        this.gpsTrackStop();

        //cleanup temp track
        if(this.currentTrack){
            // delete GPX file and record
            records.deleteAnnotation(this.currentTrack.id);
        }

        this.currentTrack = undefined;
    },

    /**
     * Resume GPS track after pause.
     */
    gpsTrackPause: function(){
        if(gpsTrackWatchID){
            if(debugGPS){
                clearInterval(gpsTrackWatchID);
            }
            else{
                navigator.geolocation.clearWatch(gpsTrackWatchID);
            }

            gpsTrackWatchID = undefined;
        }
    },

    /**
     * Is there a GPS track currently paused?
     */
    gpsTrackPaused: function(){
        return this.gpsTrackStarted() && !this.gpsTrackRunning();
    },

    /**
     * Start/Resume GPS track.
     * @param captureRate How often, in seconds, a track point should be recorded.
     * @param debug Use debug mode?
     */
    gpsTrackPlay: function(captureRate, debug){
        var cr = captureRate * 1000; // in milliseconds

        // continue tracking
        gpsTrackOnMap(cr,
                      function(position){
                          gpsCaptureAutoSave(position);
                      },
                      debug);
    },

    /**
     * Is a GPS track currently running?
     */
    gpsTrackRunning: function(){
        return gpsTrackWatchID !== undefined;
    },

    /**
     * Is a GPS track in progress?
     */
    gpsTrackStarted: function(){
        return this.currentTrack !== undefined;
    },

    /**
     * Clear GPS track watch.
     */
    gpsTrackStop: function(){
        this.gpsTrackPause();
        gpsTrackLayer.removeAllFeatures();
    },

    /**
     * Switch gps track layer on/off.
     */
    gpsTrackToggle: function(){
        gpsTrackLayer.setVisibility(!gpsTrackLayer.visibility);
    },

    /**
     * Switch gps track layer on/off.
     * @param id Annotation id.
     */
    hideTrack: function(id){
        hideGPSTrack(id);
    },

    /**
     * Display specified GPS track.
     * @param id Annotation id.
     */
    showTrack: function(id){
        showGPSTrack(id, records.getSavedRecord(id));
    },
};

return _this;

});
