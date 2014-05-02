"use strict";
define(['./tracks'], function(tracks){
    var run = function() {
        test('Tracks: do something.', function() {
            equal(2, 2, 'The return should be 2.');
        });
    };
    return {run: run}
});
