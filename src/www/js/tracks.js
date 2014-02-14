/*
Copyright (c) 2014, EDINA.
All rights reserved.

Redistribution and use in source and binary forms, with or without modification,
are permitted provided that the following conditions are met:

1. Redistributions of source code must retain the above copyright notice, this
   list of conditions and the following disclaimer.
2. Redistributions in binary form must reproduce the above copyright notice, this
   list of conditions and the following disclaimer in the documentation and/or
   other materials provided with the distribution.
3. All advertising materials mentioning features or use of this software must
   display the following acknowledgement: This product includes software
   developed by the EDINA.
4. Neither the name of the EDINA nor the names of its contributors may be used to
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

define(['map', 'records'], function(map, records){

    // GPS track layer
    // var gpsTrackLayerStyle = OpenLayers.Util.extend(
    //     {}, OpenLayers.Feature.Vector.style['default']);
    // gpsTrackLayerStyle.strokeColor = 'red';
    // gpsTrackLayerStyle.strokeWidth = 5;
    // var gpsTrackLayer = new OpenLayers.Layer.Vector(
    //     'gpsTrack',
    //     {
    //         style: gpsTrackLayerStyle,
    //     }
    // );

    /**
     * Resume GPS track after pause.
     */
    var gpsTrackPause = function(){
        if(_this.gpsTrackWatchID){
            if(_this.debugGPS){
                clearInterval(_this.gpsTrackWatchID);
            }
            else{
                navigator.geolocation.clearWatch(_this.gpsTrackWatchID);
            }

            _this.gpsTrackWatchID = undefined;
        }
    };

    /**
     * @return Start position of current GPS track.
     */
    var getGpsTrackStart = function(){
        var coords;

        var track = this.getGPSTrackLayer().features[0];

        if(track !== undefined){
            var features = track.geometry.components;
            if(features.length > 0){
                coords = {
                    'lon': features[0].x,
                    'lat': features[0].y,
                }
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

    var gpsTrackLayer = map.addLayer({
        id: 'gpsTrack',
        style:{
            colour: 'red',
            strokeWidth: 5
        },
        visible:false
    });

var _this = {

    /**
     * Complete current GPS capture.
     */
    gpsCaptureComplete: function(){
        if(typeof(this.currentTrack) !== 'undefined'){
            var annotation = records.getSavedRecord(this.currentTrack.id);

            gpsTrackPause();

            // populate record with start location
            var startPoint = this.map.getGpsTrackStart();

            if(startPoint !== undefined){
                annotation.record.point = startPoint;
                // save the annotation to local storage
                this.saveAnnotation(this.currentTrack.id, annotation);

                var id = this.currentTrack.id;

                // save the GPX file
                this.gpsCaptureSave($.proxy(function(){
                    // removing all annotation will force a refresh
                    this.map.getAnnotationsLayer().removeAllFeatures();

                    // display saved track on map
                    this.map.showGPSTrack(id, annotation);
                }, this));
            }
            else{
                console.debug('Track ' + this.currentTrack.title +
                              ' has no points');
                this.deleteAnnotation(this.currentTrack.id);
            }

            this.map.gpsTrackStop();
            this.currentTrack = undefined;
        }
    },

    /**
     * Is there a GPS track currently paused?
     */
    gpsTrackPaused: function(){
        return this.gpsTrackStarted() && !this.gpsTrackRunning();
    },

    /**
     * Is a GPS track currently running?
     */
    gpsTrackRunning: function(){
        return this.gpsTrackWatchID !== undefined;
    },

    /**
     * Is a GPS track in progress?
     */
    gpsTrackStarted: function(){
        return this.currentTrack !== undefined;
    },
};

return _this;

});
