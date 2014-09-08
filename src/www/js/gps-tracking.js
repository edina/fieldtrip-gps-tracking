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

define(['ui', 'records', 'map', 'file', 'utils', 'settings', './tracks'], function(// jshint ignore:line
    ui, records,  map, file, utils, settings, tracks){
    var currentGpsAnnotation;
    var DEFAULT_CAPTURE_RATE = 0;

    /**
     * GPS capture form page.
     */
    var annotateGpsPage = function(){
        var colour = "red";
        var defcolour = localStorage.getItem(tracks.COLOUR_INDEX);
        if(defcolour){
            colour = defcolour;
        }
        else{
            localStorage.setItem(tracks.COLOUR_INDEX, 'red');
        }

        utils.appendDateTimeToInput("#annotate-gps-form-title");

        $("#annotate-gps-colour-pick-input").spectrum({
            showPalette: true,
            showPaletteOnly: true,
            color: colour,
            change: function(color){
                localStorage.setItem(tracks.COLOUR_INDEX, color.toString());
            },
            palette: [
                ['red', 'orange', 'yellow', 'green'],
                ['blue', 'pink', 'white', 'black']
            ]
        });

        // listen on start button
        $('#annotate-gps-form-ok').click(function(event){
            $('#annotate-gps-form').submit();
        });

        // form submitted
        $('#annotate-gps-form').submit(function(event){
            if($('#annotate-gps-form-title').val().length === 0){
                $('#annotate-gps-form-title').addClass('ui-focus');
                utils.inform('Required field not populated');
            }
            else{
                currentGpsAnnotation = {
                    'record':{
                        'editor': 'track.edtr',
                        'name': $('#annotate-gps-form-title').val(),
                        'fields': [
                            {
                                'id': 'fieldcontain-textarea-1',
                                'val': $('#annotate-gps-form-description').val(),
                                'label': 'Description',
                            },
                            {
                                // track currently must be second element,
                                // see showGPSTrack
                                'id': 'fieldcontain-track-1',
                                'val': '',
                                'label': 'Track',
                                'style': {
                                    strokeColor: localStorage.getItem(tracks.COLOUR_INDEX),
                                    strokeWidth: 5,
                                    strokeOpacity: 1
                                }
                            }
                        ],
                    },
                    'isSynced': false,
                    'rate': DEFAULT_CAPTURE_RATE
                };

                utils.hideKeyboard();

                // kick off capture
                tracks.gpsTrack(currentGpsAnnotation, debugGPS());
                $('body').pagecontainer('change', 'gps-capture.html');
            }

            return false;
        });
    };

    /**
     * Should GPS tracking be run in debug mode?
     */
    var debugGPS = function(){
        return settings.get('debug-gps') === 'on';
    };

    /**
     * Delete GPX file from device.
     * @param e
     * @param annotation FT annotation.
     */
    var deleteGPXFile = function(e, annotation){
        var type = records.getEditorId(annotation);
        if(type === 'track'){
            $.each(annotation.record.fields, function(i, field){
                if(field.id === 'fieldcontain-track-1'){
                    var gpxFile = field.val;
                    file.deleteFile(
                        gpxFile.substr(gpxFile.lastIndexOf('/') + 1),
                        records.getAssetsDir(),
                        function(){
                            console.debug("GPX file deleted: " + gpxFile);
                        }
                    );

                    return;
                }
            });
        }
    };

    /**
     * Initialise GPS capture page.
     */
    var gpsCapturePage = function(){
        var config = utils.getConfig();
        ui.mapPage('gpscapture-map');

        var changeToResume = function(){
            $("#gpscapture-pause-play").text('Resume');
            $("#gpscapture-pause-play").removeClass('pause')
                                       .addClass('play');
        };

        var gotoPage = function(page){
            if(utils.str2bool(config.gotomapaftergpssave)){
                utils.changePage(page);
            }
            else{
                $('#gpscapture-confirm-popup').popup('close');
            }
        };

        if(tracks.gpsTrackPaused()){
            changeToResume();
        }

        // save GPS route
        $('#gpscapture-confirm-save').click(function(){
            currentGpsAnnotation = undefined;
            tracks.gpsCaptureComplete(function(){
                map.showRecordsLayer();
                gotoPage('map.html');
            });
        });

        // cancel GPS route save
        $('#gpscapture-confirm-cancel').click(function(){
            tracks.gpsTrack();
        });

        // pause/resume GPS track button
        $('#gpscapture-pause-play').click(function(){
            if($("#gpscapture-pause-play").hasClass('pause')){
                tracks.gpsTrackPause();
                changeToResume();
            }
            else{
                tracks.gpsTrackPlay(currentGpsAnnotation.rate, debugGPS());
                $("#gpscapture-pause-play").text('Pause');
                $("#gpscapture-pause-play").removeClass('play')
                                           .addClass('pause');
            }

            $('#gpscapture-pause-play').removeClass('ui-btn-active');
        });

        // toogle track visibility
        $('#gpscapture-toggle-route').click(function(){
            tracks.gpsTrackToggle();
            $('#gpscapture-toggle-route').removeClass('ui-btn-active');
        });

        // discard track
        $('#gpscapture-confirm-discard').click(function(){
            currentGpsAnnotation = undefined;
            tracks.gpsCaptureDiscard();
            $('#gpscapture-toggle-route').removeClass('ui-btn-active');
            gotoPage('index.html');
        });

        if(config.showrrecordsongpstrackingpage){
            map.showRecordsLayer();
        }

        map.hideAnnotateLayer();
    };

    // load spectrum js and css files for colour picker
    $.getScript('js/ext/spectrum.js');
    $('head').prepend('<link rel="stylesheet" href="css/ext/spectrum.css" type="text/css" />');

    // load gpx styles
    $('head').prepend('<link rel="stylesheet" href="plugins/gps-tracking/css/style.css" type="text/css" />');

    // initial annotate page form
    $(document).on('pagecreate', '#annotate-gps-page', annotateGpsPage);

    // the page that the track runs on
    $(document).on('pagecreate', '#gpscapture-page', gpsCapturePage);

    // show / hide gps track running icon
    $(document).on('pagecontainerbeforeshow', function(event, ui){
        if(tracks.gpsTrackStarted()){
            $('.gps-track-start').attr('href', 'gps-capture.html');
            $('.gpstrack-running').show();
        }
        else{
            $('.gps-track-start').attr('href', 'annotate-gps.html');
            $('.gpstrack-running').hide();
        }
    });

    $(document).on('_pageshow', '#gpscapture-page', function(){
        map.startLocationUpdate({autopan: 'soft'});
        map.startCompass();
        map.updateSize();
    });

    $(document).on('pageremove', '#gpscapture-page', function(){
        map.stopLocationUpdate();
        map.stopCompass();
    });

    // click on gps capture running icon
    $(document).on(
        'vmousedown',
        '.gpstrack-running',
        function(event){
            // timout hack prevents the clicking on the button on the
            // same position on the next page
            setTimeout(function(){
                $('body').pagecontainer('change', 'gps-capture.html');
                event.stopPropagation();
            }, 400);

            return false;
        }
    );

    // listen for hide records event
    $(document).on(map.EVT_HIDE_RECORDS, function(){
        map.hideLayerByName('gps-track-');
    });

    // listen for delete annotation event
    $(document).on(records.EVT_DELETE_ANNOTATION, deleteGPXFile);

    // add new asset type to fieldtrip
    records.addAssetType('track');
});
