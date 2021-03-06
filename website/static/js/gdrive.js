/*
format of Google Drive file/folder resource object
--------------------------------------------------
alternateLink: "https://docs.google.com/folderview?id=0B71wddT5Cwf-cXBDa0FHNk9qRE0&usp=drivesdk"
appDataContents: false
copyable: false
createdDate: "2013-11-06T15:22:03.813Z"
editable: true
etag: ""SQFIsIrlQ4j3H07nwR6GyVXbP4s/MTM4Mzc1MTMyMzgxMw""
iconLink: "https://ssl.gstatic.com/docs/doclist/images/icon_11_shared_collection_list.png"
id: "0B71wddT5Cwf-cXBDa0FHNk9qRE0"
kind: "drive#file"
labels: Object
lastModifyingUser: Object
lastModifyingUserName: "J Wilson"
lastViewedByMeDate: "2013-11-06T15:22:05.463Z"
mimeType: "application/vnd.google-apps.folder"
modifiedDate: "2013-11-06T15:22:03.813Z"
ownerNames: Array[1]
owners: Array[1]
parents: Array[1]
quotaBytesUsed: "0"
shared: true
title: "Population"
userPermission: Object
webViewLink: "https://www.googledrive.com/host/0B71wddT5Cwf-cXBDa0FHNk9qRE0/"
writersCanShare: true
*/

// Auth
const CLIENT_ID = '1087881665848.apps.googleusercontent.com';
const SCOPES = 'https://www.googleapis.com/auth/drive';

// Folders
const STORYMAP_ROOT_FOLDER = 'KnightLabStoryMap';
const PUBLIC_SUBFOLDER = 'public';

// Uploads
const BOUNDARY = '-------314159265358979323846';
const MULTIPART_DELIMITER = "\r\n--" + BOUNDARY + "\r\n";
const MULTIPART_CLOSE = "\r\n--" + BOUNDARY + "--";

const STORYMAP_TEMPLATE = { storymap: { slides: [] }};
var STORYMAP_INFO = {};


function utf8_to_b64(str) {
    return window.btoa(unescape(encodeURIComponent(str)));
}

////////////////////////////////////////////////////////////
// Requests
////////////////////////////////////////////////////////////

function gdrive_multipartRequestBody(metadata, contentType, base64Data) {
    var r = MULTIPART_DELIMITER
        + 'Content-Type: application/json\r\n\r\n';
    if (metadata) {
        r += JSON.stringify(metadata);
    }
    r += MULTIPART_DELIMITER
        + 'Content-Type: '+contentType+'\r\n'
        + 'Content-Transfer-Encoding: base64\r\n'
        + '\r\n';
    if (base64Data) {
        r += base64Data;
    }
    r += MULTIPART_CLOSE;
    return r;
}

function gapiRequest(method, metadata, contentType, base64Data) {
    return gapi.client.request({
        'path': '/upload/drive/v2/files',
        'method': method,
        'params': {
            'uploadType': 'multipart'
        },
        'headers': {
            'Content-Type': 'multipart/mixed; boundary="'+BOUNDARY+'"'
        },
        'body': gdrive_multipartRequestBody(metadata, contentType, base64Data)
    });
}

function gapiPUTRequest(fileId, contentType, base64Data) {
    return gapi.client.request({
        'path': '/upload/drive/v2/files/'+fileId,
        'method': 'PUT',
        'params': {'uploadType': 'multipart'},
        'headers': {
            'Content-Type': 'multipart/mixed; boundary="'+BOUNDARY+'"'
        },
        'body': gdrive_multipartRequestBody(null, contentType, base64Data)
    });
}

// callback(error, response)
// error = string || {code: <int>, message: <string> }
function gdrive_exec(request, callback, debug) {
    request.execute(function(response) {
        if(response.error) {
// DEBUG START
//console.log('gdrive_exec', response.error, response.error.code);
// DEBUG END           
            // If authorization error, try to reauthorize and re-exec
            if(response.error.code == 401 || response.error.code == 403) {
                gdrive_check_auth(function(authorized) {         
                    if(authorized) {
                        gdrive_exec(request, callback, debug);
                    } else {
                        callback(response.error, null);
                    }
                });
            } else {
                callback(response.error, null);
            }
        } else {
            callback(null, response);
        }   
    });
}

//////////////////////////////////////////////////////////////////////
// File handling
//
// callback = function(error, <file resource> || null)
// https://developers.google.com/drive/v2/reference/files#resource
//////////////////////////////////////////////////////////////////////

function gdrive_file_create(title, content, parents, callback) {
    var metadata = {
        'title': title,
        'mimeType': 'application/json'
    };
    if (parents) {
        metadata['parents'] = parents;
    }
    var contentType = 'application/json';
    var base64Data = utf8_to_b64(content);
    
    var request = gapiRequest('POST', metadata, contentType, base64Data);   
    gdrive_exec(request, callback);
}

function gdrive_file_find(query, callback) {
    gdrive_exec(
        gapi.client.drive.files.list({q: query}),
        function(error, response) {
            if(error) {
                callback(error);
            } else if(!response.items || response.items.length < 1) {
                callback(null);
            } else if(response.items.length > 1) {
                callback('Multiple files found');
            } else {
                callback(null, response.items[0]);
            }        
        }
    );
}

function gdrive_file_get(id, callback) {
    var request = gapi.client.drive.files.get({'fileId': id});
    gdrive_exec(request, callback);
}

function gdrive_file_update(id, content, callback) {
    var request = gapiPUTRequest(id, 'application/json', utf8_to_b64(content));
    gdrive_exec(request, callback);
}

function gdrive_file_delete(id, callback) {
    var request = gapi.client.drive.files.delete({'fileId': id});
    gdrive_exec(request, callback);
}

////////////////////////////////////////////////////////////
// File-system related
////////////////////////////////////////////////////////////

// callback(error, <permissions resource>)
function gdrive_perm_public(id, callback) {
    var request = gapi.client.drive.permissions.insert({
        'fileId': id,
        'resource': {
            'value': '',
            'type': 'anyone',
            'role': 'reader'
        }
    });    
    gdrive_exec(request, callback);
}

// callback(error, [<file resource>])
function gdrive_list(query, callback) {
    var request = gapi.client.drive.files.list({q: query});
    gdrive_exec(request, function(error, response) {
        callback(error, (response) ? response.items : null);
    });
}

// callback(error, <file resource>)
function gdrive_folder_create(name, parents, callback) {
    var contentType = 'application/vnd.google-apps.folder';
    var metadata = { 
        'title': name,
        'mimeType': contentType
    };
    if (parents) {
        metadata['parents'] = parents;
    }
    var request = gapiRequest('POST', metadata, contentType);
    gdrive_exec(request, function(error, resource) {
        if(error) {
            callback(error);
        } else {
            gdrive_perm_public(resource.id, function(error, p) {
                callback(error, resource);
            });
        }    
    });
}

// callback = function(error, <file resource>)
function gdrive_folder_getcreate(name, parents, callback) {
    var query = "title='"+name+"' and trashed=false";
    $.each(parents, function(i, parent) {
        query += " and '"+parent.id+"' in parents";
    });

    gdrive_list(query, function(error, items) {
        if(error) {
            callback(error);
        } else if(items.length > 1) {
            callback('Multiple folders found');
        } else if(items.length > 0) {
            callback(null, items[0]);
        } else {
            gdrive_folder_create(name, parents, callback);
        }    
    });
}

// callback = function(error, <file resource>)
function gdrive_mkdirs(path, parent, callback) {
    if(typeof path === 'string') {
        path = path.split('/');
    }
    var parents = [];
    if (parent) {
        parents = [parent];
    }
    if (path.length === 1) {
        gdrive_folder_getcreate(path[0], parents, callback);
    } else {
        gdrive_folder_getcreate(path[0], parents, function(error, folder) {
            if(error) {
                callback(error);
            } else {
                gdrive_mkdirs(path.slice(1), folder, callback);
            }
        });
    }
}

//////////////////////////////////////////////////////////////////////
// StoryMap stuff
//////////////////////////////////////////////////////////////////////

//
// Initialize StoryMap folders on google drive
// callback(error, <public folder resource>)
//
function gdrive_storymap_init(create, callback) {
    var query = "title='"+STORYMAP_ROOT_FOLDER+"' and trashed=false";
    
    // Look for StoryMap root folder
    gdrive_file_find(query, function(error, rootFolder) {
        if(error) {
            callback(error);
        } else if(!rootFolder) {
            if(!create) {
                callback('Error getting StoryMap folder');
            } else {         
                gdrive_folder_create(STORYMAP_ROOT_FOLDER, null, function(error, rootFolder) {
                    if(error) {
                        callback(error);
                    } else {
                        gdrive_storymap_init(create, callback);
                    }                 
                });
            }       
        } else {
            // Look for public folder
            query = "title='"+PUBLIC_SUBFOLDER+"' and trashed=false"
                + " and '"+rootFolder.id+"' in parents";
            gdrive_file_find(query, function(error, publicFolder) {
                if(error) {
                    callback(error);
                } else if(!publicFolder) {
                    if(!create) {
                        callback('Error getting public folder');
                    } else {
                        gdrive_folder_create(PUBLIC_SUBFOLDER, [rootFolder], callback);
                    }
                } else {
                    callback(error, publicFolder);
                }           
            });
        }
    });
}

//
// Process storymap folder by adding draft_on and published_on datetime strings
// callback(error)
//
function _gdrive_storymap_process(folder, callback) {
    folder['draft_on'] = '';
    folder['published_on'] = '';

    var q = "trashed=false and '"+folder.id+"' in parents";

    gdrive_list(q, function(error, file_list) {
        if(!error) {
            for(var i = 0; i < file_list.length; i++) {
                var file = file_list[i];        
                if(file.title == 'draft.json') {
                    folder['draft_on'] = file.modifiedDate;
                } else if(file.title == 'published.json') {
                    folder['published_on'] = file.modifiedDate;             
                }
            }            
        }        
        callback(error);
    });
}

//
// List storymaps in parentFolder
// callback(error, { storymap info by id })
//
function gdrive_storymap_list(parentFolder, callback) {
    var folder_map = {};

    var _process_folders = function(folder_list) {
        if(folder_list && folder_list.length) {
            folder = folder_list.shift();
            
            _gdrive_storymap_process(folder, function(error) {
                if(error) {
                    callback(error);
                } else {
                    folder_map[folder.id] = folder;          
                    _process_folders(folder_list);
                }
            });
        } else {
            callback(null, folder_map);
        }
    };
        
    var q = "'"+parentFolder.id+"' in parents and trashed=false";
    
    gdrive_list(q, function(error, folder_list) {
        if(error) {
            callback(error);
        } else {
            _process_folders(folder_list);
        }
    });
}

//
// Create storymap in rootFolder
// callback(error, <folder resource>)
//
function gdrive_storymap_create(title, rootFolder, callback) {
    var data = JSON.stringify(STORYMAP_TEMPLATE);
    
    gdrive_folder_create(title, [rootFolder], function(error, storymapFolder) {
        if(error) {
            callback(error);
        } else {
            gdrive_file_create('draft.json', data, [storymapFolder], function(error, response) {
                callback(error, storymapFolder);
            });
        }
    });
}

//
// Load storymap (info only)
// callback(error, <folder resource>)
//
function gdrive_storymap_load(storymap_id, callback) {
    gdrive_file_get(storymap_id, function(error, folder) {
        if(error) {
            callback(error);
        } else {
            _gdrive_storymap_process(folder, function(error) {
                callback(error, folder);
            });
        }
    }); 
}

//
// Load draft.json from storymapFolder
// callback(error, data)
//
function gdrive_storymap_load_draft(storymapFolder, callback) {
    var url = gdrive_storymap_draft_url(storymapFolder);
    
    $.getJSON(url)
        .done(function(data) {
            callback(null, data);
        })
        .fail(function(xhr, textStatus, error) {
            callback(textStatus+', '+error);
        });
}

//
// Save draft.json in storymapFolder
// callback(error, <file resource>)
//
function gdrive_storymap_save_draft(storymapFolder, data, callback) {
    var content = JSON.stringify(data);
    var query = "title='draft.json' and trashed=false"
        + " and '"+storymapFolder.id+"' in parents";
        
    gdrive_file_find(query, function(error, file) {
        if(error) {
            callback(error);
        } else if(file) {
            gdrive_file_update(file.id, content, function(error, file) {
                if(file) {
                    storymapFolder['draft_on'] = file.modifiedDate;
                }
                callback(error, file);
            });
        } else {
            gdrive_file_create('draft.json', content, [storymapFolder], function(error, file) {
                if(file) {
                    storymapFolder['draft_on'] = file.modifiedDate;
                }
                callback(error, file);
            });
        }
    });
}

//
// Save published.json
// callback(error, <file resource>)
//
function gdrive_storymap_publish(storymapFolder, callback) {
    var query = "title='published.json' and trashed=false"
        + " and '"+storymapFolder.id+"' in parents";

    // Load content from draft.json
    gdrive_storymap_load_draft(storymapFolder, function(error, data) {
        if(error) {
            callback(error);
        } else {
            var content = JSON.stringify(data);
            // Create/update published.json
            gdrive_file_find(query, function(error, file) {
                if(error) {
                    callback(error);
                } else if(file) {
                    gdrive_file_update(file.id, content, callback);                
                } else {
                    gdrive_file_create('published.json', content, [storymapFolder], callback);               
                }
            });
        }
    });
}

function gdrive_storymap_draft_url(storymapFolder) {
    return storymapFolder.webViewLink + 'draft.json';
}

function gdrive_storymap_published_url(storymapFolder) {
    return storymapFolder.webViewLink + 'published.json';
}

////////////////////////////////////////////////////////////
// Login/Authorization
// callback(<boolean success value>)
////////////////////////////////////////////////////////////

function gdrive_about(callback) {
    var request = gapi.client.drive.about.get();
    gdrive_exec(request, callback);        
}

function gdrive_login(callback) {
    gapi.auth.authorize(
        {'client_id': CLIENT_ID, 'scope': SCOPES, 'immediate': false}, 
        function(authResult) {     
            callback(authResult != null && !authResult.error);        
        }
    );
}

function gdrive_check_auth(callback) {
    gapi.auth.authorize(
        {'client_id': CLIENT_ID, 'scope': SCOPES, 'immediate': true},
        function(authResult) {
            callback(authResult != null && !authResult.error);
        }
    );
}

