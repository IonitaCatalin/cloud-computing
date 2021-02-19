const axios = require('axios');
const {Log,Response} = require('./models')
require('dotenv').config()

const getDataFromMapboxAPI = async function(location){
    return axios({
        method: "get",
        url: `${process.env.MAPBOX_GEOCODING}/${location}.json?access_token=${process.env.MAPBOX_KEY_API}`,
      }).then(res => res.data);
}
const getDataFromWeatherAPI = async function(lat,long){
    return axios({
        method: "get",
        url: `${process.env.WEATHER}/current.json?key=${process.env.WEATHER_KEY_API}&q=${lat},${long}`,
      }).then(res => res.data);
}

const getDataFromSunAPI = async function(lat,long,date){
    return axios({
        method: "get",
        url: `${process.env.SUNRISE_SUNSET}/json?lat=${lat}&lng=${long}&date=${date}`,
      }).then(res => res.data);
}

const getDataFromTimeAPI = async function(lat,long){
    return axios({
        method: "get",
        url: `${process.env.IPGEOLOCATION}?apiKey=${process.env.IPGEOLOCATION_KEY_API}&lat=${lat}&long=${long}`,
      }).then(res => res.data);
}

const searchForMetadata = async function(req,res){
    var requestBody = '';
    var location = '';
    req.on('data', chunk => {
        requestBody += chunk.toString(); 
    });
    req.on('end', async () => {
        result = JSON.parse(requestBody);
        try{
            const suggestionOnLocations = await getDataFromMapboxAPI(result['location']);
            if(suggestionOnLocations['features'].length == 0){

                const response = {status : 'failed','message': 'Location not found anywhere'}
                res.writeHead(404,{'Content-Type':'application/json'})
                res.write(JSON.stringify(response));
                res.end();
            }
            else{
                var lookupLocation = suggestionOnLocations['features'][0];
                var lat = lookupLocation['geometry']['coordinates'][1];
                var long = lookupLocation['geometry']['coordinates'][0];
                const currentWeatherConditions = await getDataFromWeatherAPI(lat,long);
                const temporalCoordinates = await getDataFromTimeAPI(lat,long)
                var temperatureCelsius = currentWeatherConditions['current']['temp_c'];
                var windKph = currentWeatherConditions['current']['wind_kph'];
                var date = temporalCoordinates['date'];
                var time = temporalCoordinates['time_24'];
                const solarPosition = await getDataFromSunAPI(lat,long,date)
                var dayLength = solarPosition['results']['day_length'];
                
                res.writeHead(200,{'Content-Type':'application/json'});
                const response = {status:'success',
                            'content':
                                     {
                                      'name':result['location'],
                                      'latitude':lat,
                                      'longitude':long,
                                      'temperatureCelsius':temperatureCelsius,
                                      'windKph':windKph,
                                      'date':date,
                                      'time':time,
                                      'dayLength':dayLength,
                                    },
                            'message':'Data retrieved succesfully for the given location'};
                res.write(JSON.stringify(response));
                res.end();
            }

        }
        catch(err){
            const response = {status : 'failed','message': 'Internat server problem'}
            res.writeHead(500,{'Content-Type':'application/json'})
            res.write(JSON.stringify(response));
            res.end();
        }
    });
}

const getMetricsForApp = async function(req,res){
    try{
        const dbLogs = await Log.find().populate("response")
        var sumOfLatencies = 0;
        var biggestLatency = 0;
        var getRequests = 0;
        var postRequests = 0;
        dbLogs.forEach(element=>{
            if(element['latency']>biggestLatency)
                biggestLatency = element['latency'];
            if(element['method'] == 'GET')
                getRequests+=1;
            if(element['method'] == 'POST')
                postRequests+=1;
            sumOfLatencies += element['latency'];
        });
        res.writeHead(200,{'Content-Type':'application/json'});
        res.write(JSON.stringify({
                averageLatency:sumOfLatencies/dbLogs.length,
                biggestLatency:biggestLatency,
                getRequestsCount:getRequests,
                postRequestsCount:postRequests,
                lastRequest:dbLogs[dbLogs.length-1]
        }));
        res.end();


    }catch(err){
            console.log(err);
            const responseJSON = JSON.stringify({status : 'failed','message': 'Internat server problem'});
            res.writeHead(500,{'Content-Type':'application/json'})
            res.write(responseJSON);
            res.end();
    }
}

module.exports = {
    searchForMetadata,
    getMetricsForApp
}