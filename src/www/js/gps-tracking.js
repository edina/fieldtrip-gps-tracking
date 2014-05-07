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

define(['ui', 'records', 'map', 'utils', 'settings', 'config', './tracks'], function(ui, records,  map, utils, settings, config, tracks){
    var currentGpsAnnotation;

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

        // we need to add colour picker input dynamically otherwise
        // JQM will attempt to format the input element
        $('#annotate-gps-colour-pick').append('<input id="annotate-gps-colour-pick-input" type="color" name="color" />');

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
                    'rate': $('#annotate-gps-form-rate').val()
                };

                utils.hideKeyboard();

                // kick off capture
                tracks.gpsTrack(currentGpsAnnotation, debugGPS());
                $.mobile.changePage('gps-capture.html');
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
     * Initialise GPS capture page.
     */
    var gpsCapturePage = function(){
        ui.mapPage('gpscapture-map');

        var changeToResume = function(){
            $("#gpscapture-pause-play .ui-btn-text").text('Resume');
            $("#gpscapture-pause-play .ui-icon").css('background-image',
                                                     'url("css/images/play.png")');
        };

        var gotoPage = function(page){
            if(typeof(config.leave_after_gps_save_discard) === 'undefined' ||
               utils.str2bool(config.go_to_map_after_gps_save)){
                $.mobile.changePage(map);
            }
        };

        if(tracks.gpsTrackPaused()){
            changeToResume();
        }

        // save GPS route
        $('#gpscapture-confirm-save').click(function(e){
            currentGpsAnnotation = undefined;
            tracks.gpsCaptureComplete();
            gotoPage('map.html');
        });

        // cancel GPS route save
        $('#gpscapture-confirm-cancel').click(function(){
            tracks.gpsTrack();
        });

        // pause/resume GPS track button
        $('#gpscapture-pause-play').click(function(){
            if($("#gpscapture-pause-play").text().trim() === 'Pause'){
                tracks.gpsTrackPause();
                changeToResume();
            }
            else{
                tracks.gpsTrackPlay(currentGpsAnnotation.rate, debugGPS());
                $("#gpscapture-pause-play .ui-btn-text").text('Pause');
                $("#gpscapture-pause-play .ui-icon").css(
                    'background-image',
                    'url("plugins/gps-tracking/css/images/pause.png")');
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

        if(config.show_records_on_gps_tracking_page){
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
    $(document).on('pageinit', '#annotate-gps-page', annotateGpsPage);

    // the page that the track runs on
    $(document).on('pageinit', '#gpscapture-page', gpsCapturePage);

    // Check if annotation popup should be shown automatically
    $(document).on(
        'pageshow',
        '#gpscapture-page',
        function(){
            map.updateSize();
        }
    );

    // show / hide gps track running icon
    $(document).on(
        'pagebeforeshow',
        'div[data-role="page"]',
        function(event){
            if(tracks.gpsTrackStarted()){
                $('.gpstrack-running').show();
            }
            else{
                $('.gpstrack-running').hide();
            }
        }
    );

    // click on gps capture running icon
    $(document).on(
        'vmousedown',
        '.gpstrack-running',
        function(event){
            // timout hack prevents the clicking on the button on the
            // same position on the next page
            setTimeout(function(){
                $.mobile.changePage('gps-capture.html');
                event.stopPropagation();
            }, 400);

            return false;
        }
    );

});
