// Requires http://momentjs.com

Array.prototype.remove = function(item) {
    for(var i = this.length; i--;) {
        if(this[i] === item) {
            this.splice(i, 1);
        }
    }
};

Array.prototype.move = function(from, to) {
    this.splice(to, 0, this.splice(from, 1)[0]);
};

function parseQueryString() {
    var nvpair = {};
    var qs = window.location.search.replace('?', '');
    var pairs = qs.split('&');
    
    for(var i = 0, p; i < pairs.length;i++) {
        p = pairs[i].split('=');
        nvpair[p[0]] = p[1];
    }
    return nvpair;
}

function format_dt(dt_string) {
    var m = moment(dt_string);
    return m.format('ll')+' at '+m.format('LT');
}

function do_ajax(url, data, on_error, on_success) {
    $.ajax({
        url: url,
        data: data,
        dataType: 'json',
        timeout: 45000, // ms
        error: function(xhr, status, err) {
            on_error(err || status);
        },
        success: function(data) {
            if(data.error) {
                on_error(data.error);
            } else {
                on_success(data);
            }
        }
    });
}

function show_error(msg) {
    hide_progress();
    $('#error_msg').html(msg);
    $('#error_modal').modal('show');
}

function hide_error() {
    $('#error_modal').modal('hide');
}

function show_progress(msg) {
    hide_error();
    $('#progress_msg').html(msg);
    $('#progress_modal').modal('show');
}

function hide_progress() {
    $('#progress_modal').modal('hide');
}

function show_confirm(msg, callback) {
    $('#confirm_msg').html(msg);
    $('#confirm_modal .btn-primary').bind('click.confirm', function(event) {
        $(this).unbind('click.confirm');
        $('#confirm_modal').modal('hide');
        if(callback) {
            callback();
        }
    });
    $('#confirm_modal').modal('show');
}

function show_message(msg, callback) {
    $('#message_msg').html(msg);
    $('#message_modal .btn').bind('click.confirm', function(event) {
        $(this).unbind('click.confirm');
        $('#message_modal').modal('hide');
        if(callback) {
            callback();
        }
    });
    $('#message_modal').modal('show');
}

/*   OSMMapType for Google Maps API V3
    <https://developers.google.com/maps/documentation/javascript/>
    This code shadoes code in VCO.Map.Leaflet.js -- keep them in sync or unify into a single source file.
================================================== */
if (typeof(google) != "undefined" && google.maps) {
    google.maps.OSMMapType = function() {
        var map_url = 'http://{S}.tile.openstreetmap.org/{Z}/{X}/{Y}.png';
        var subdomains = 'ab';
        return google.maps.ImageMapType.call(this, {
            "getTileUrl": function(coord, zoom) {
                var numTiles = 1 << zoom,
                    wx = coord.x % numTiles,
                    x = (wx < 0) ? wx + numTiles : wx,
                    y = coord.y,
                    index = (zoom + x + y) % subdomains.length;
                return map_url
                    .replace("{S}", subdomains[index])
                    .replace("{Z}", zoom)
                    .replace("{X}", x)
                    .replace("{Y}", y);
            },
            "tileSize": new google.maps.Size(256, 256),
            "name":     'OpenStreetMap Standard',
            "minZoom":  0,
            "maxZoom":  19
        });
    }
    google.maps.OSMMapType.prototype = new google.maps.ImageMapType("_");
}
