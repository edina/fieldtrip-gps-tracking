### GPS Tracking

GPS Tracking is a [Fieldtrip Open](https://github.com/edina/fieldtrip-open) plugin for creating GPX tracks.

#### Add New Button

The following is an example of adding a GPS Track button to a page:

```
{
    "body": {
        "section1": {
            "items": {
                "item4": {
                    "div": {"class": "ui-block-d"},
                    "a": {"class": "gps-track-start", "href": "annotate-gps.html"},
                    "img": {"src": "css/images/gps.png", "alt": "Capture GPS Track"},
                    "title": "GPS Track"
                }
            }
        }
    }
}
```
