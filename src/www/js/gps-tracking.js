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

define(['ui', 'map', './tracks'], function(ui, map, tracks){

    /**
     * Initialise GPS capture page.
     */
    var gpsCapturePage = function(){
        ui.mapPage('gpscapture-map');
        //this.commonMapPageInit();

        var changeToResume = function(){
            $("#gpscapture-pause-play .ui-btn-text").text('Resume');
            $("#gpscapture-pause-play .ui-icon").css('background-image',
                                                     'url("css/images/play.png")');
        }

        if(tracks.gpsTrackPaused()){
            changeToResume();
        }

        // save GPS route
        $('#gpscapture-confirm-save').click($.proxy(function(e){
            this.annotations.gpsCaptureComplete();
            $.mobile.changePage('map.html');
        }, this));

        // cancel GPS route save
        $('#gpscapture-confirm-cancel').click($.proxy(function(){
            this.annotations.gpsTrack();
        }, this));

        // pause/resume GPS track button
        $('#gpscapture-pause-play').click($.proxy(function(){
            if($("#gpscapture-pause-play").text().trim() === 'Pause'){
                this.annotations.gpsTrackPause();
                changeToResume();
            }
            else{
                this.annotations.gpsTrackPlay(
                    this.currentGpsAnnotation.rate,
                    this.settings.debugGPS());
                $("#gpscapture-pause-play .ui-btn-text").text('Pause');
                $("#gpscapture-pause-play .ui-icon").css('background-image',
                                                         'url("css/images/pause.png")');
            }

            $('#gpscapture-pause-play').removeClass('ui-btn-active');
        }, this));

        // toogle track visibility
        $('#gpscapture-toggle-route').click($.proxy(function(){
            this.map.gpsTrackToggle();
            $('#gpscapture-toggle-route').removeClass('ui-btn-active');
        }, this));

        // discard track
        $('#gpscapture-confirm-discard').click($.proxy(function(){

            this.annotations.gpsCaptureDiscard();

            $('#gpscapture-toggle-route').removeClass('ui-btn-active');
            $.mobile.changePage('map.html');
        }, this));

        // kick off capture
        this.annotations.gpsTrack(this.currentGpsAnnotation, this.settings.debugGPS());

        this.map.hideAnnotateLayer();

        this.map.updateSize();
    };


    $(document).on('pageshow',
                   '#gpscapture-page',
                   gpsCapturePage);
});