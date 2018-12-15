import {Component, OnInit} from '@angular/core';
import {ViewController, PopoverController, NavController, ToastController} from 'ionic-angular';
import { Validators, FormBuilder, FormGroup, FormControl } from '@angular/forms';
import { Observable } from 'rxjs/Observable';

import { FirebaseService } from '../firebase-integration.service';
import {TabsNavigationPage} from "../../tabs-navigation/tabs-navigation";
import { GoogleMap } from "../../../components/google-map/google-map";
import { GoogleMapsService } from "../../maps/maps.service";
import { MapsModel, MapPlace } from '../../maps/maps.model';
import { normalizeURL } from 'ionic-angular';
import {Camera} from "@ionic-native/camera";
import firebase from 'firebase';

@Component({
    selector: 'page-firebase-new-company',
    templateUrl: 'firebase-new-company.html'
})
export class FirebaseNewCompanyPage {
    map_model: MapsModel = new MapsModel();
    toast:any;
    location:any;
    imageUrl:any;

    validations_form: FormGroup;

    constructor(
        public viewCtrl: ViewController,
        public formBuilder: FormBuilder,
        public popoverCtrl: PopoverController,
        public GoogleMapsService: GoogleMapsService,
        public firebaseService: FirebaseService,
        public nav: NavController,
        public toastCtrl: ToastController,
        public camera: Camera,
    ){}

    ionViewWillLoad(){
        this.resetFields()
    }

    resetFields(){
        this.validations_form = this.formBuilder.group({
            siege: new FormControl('', Validators.required),
            activite: new FormControl('', Validators.required),
            description: new FormControl('', Validators.required),
            ville: new FormControl('', Validators.required),
            imageUrl: '',

        });
    }

    dismiss() {
        this.viewCtrl.dismiss();
    }

    searchPlacesPredictions(query: string){
        let env = this;
        console.log('hello');
        if(query !== "")
        {
            env.GoogleMapsService.getPlacePredictions(query).subscribe(
                places_predictions => {
                    env.map_model.search_places_predictions = places_predictions;
                },
                e => {
                    console.log('onError: %s', e);
                },
                () => {
                    console.log('onCompleted');
                }
            );
        }else{
            env.map_model.search_places_predictions = [];
        }
    }

    setOrigin(location: google.maps.LatLng){
        let env = this;

        // Clean map
        env.map_model.cleanMap();

        // Set the origin for later directions
        env.map_model.directions_origin.location = location;

        env.map_model.addPlaceToMap(location, '#00e9d5');

        // With this result we should find restaurants (*places) arround this location and then show them in the map

        // Now we are able to search *restaurants near this location
        env.GoogleMapsService.getPlacesNearby(location).subscribe(
            nearby_places => {
                // Create a location bound to center the map based on the results
                let bound = new google.maps.LatLngBounds();

                for (var i = 0; i < nearby_places.length; i++) {
                    bound.extend(nearby_places[i].geometry.location);
                    env.map_model.addNearbyPlace(nearby_places[i]);
                }

                // Select first place to give a hint to the user about how this works
                env.choosePlace(env.map_model.nearby_places[0]);

                // To fit map with places
                env.map_model.map.fitBounds(bound);
            },
            e => {
                console.log('onError: %s', e);
            },
            () => {
                console.log('onCompleted');
            }
        );
    }
    choosePlace(place: MapPlace) {
        let env = this;

        // Check if the place is not already selected
        if (!place.selected) {
            // De-select previous places
            env.map_model.deselectPlaces();
            // Select current place
            place.select();

            // Get both route directions and distance between the two locations
            let directions_observable = env.GoogleMapsService
                    .getDirections( env.map_model.directions_origin.location, place.location ),
                distance_observable = env.GoogleMapsService
                    .getDistanceMatrix( env.map_model.directions_origin.location, place.location );


            Observable.forkJoin( directions_observable, distance_observable ).subscribe(
                data => {
                    let directions = data[0],
                        distance = data[1].rows[0].elements[0].distance.text,
                        duration = data[1].rows[0].elements[0].duration.text;

                    env.map_model.directions_display.setDirections( directions );

                    if (env.toast) {
                        env.toast.dismiss();
                    }

                    env.toast = this.toastCtrl.create( {
                        message: 'That\'s ' + distance + ' away and will take ' + duration,
                        duration: 2000
                    } );
                    env.toast.present();
                },
                e => {
                    console.log( 'onError: %s', e );
                },
                () => {
                    console.log( 'onCompleted' );
                }
            );
        }
    }

    selectSearchResult(place: google.maps.places.AutocompletePrediction){
        let env = this;

        env.map_model.search_query = place.description;
        env.map_model.search_places_predictions = [];

        // We need to get the location from this place. Let's geocode this place!
        env.GoogleMapsService.geocodePlace(place.place_id).subscribe(
            place_location => {
                env.location =
                    {
                      lat: place_location.lat(),
                        lng: place_location.lng(),
                    }

             //   env.setOrigin(place_location);
            },
            e => {
                console.log('onError: %s', e);
            },
            () => {

                console.log('onCompleted');

            }
        );
    }

    onTakePhoto() {

        this.camera.getPicture({
            destinationType: this.camera.DestinationType.DATA_URL,
            quality : 95,
            targetWidth: 500,
            targetHeight: 500,
            saveToPhotoAlbum: true,
            encodingType: this.camera.EncodingType.PNG,
            sourceType : this.camera.PictureSourceType.CAMERA,
            mediaType: this.camera.MediaType.PICTURE,
            correctOrientation: true
        }).then( profilePicture =>{const selfieRef = firebase.storage().ref('profilePictures/user1/profilePicture.png');
            selfieRef
                .putString(profilePicture, 'base64', {contentType: 'image/png'})
                .then(savedProfilePicture => {
                    firebase
                        .database()
                        .ref(`users/user1/profilePicture`)
                        .set(savedProfilePicture.downloadURL);
                });
            }
        ).catch(
            (error) => {
                this.toastCtrl.create({
                    message: error.message,
                    duration: 3000,
                    position: 'bottom'
                }).present();
            }
        )
    }

    onSubmit(value){
        let role = 'pro';
        this.firebaseService.createCompany(value, role, this.location, this.imageUrl).then(
            res => {
                this.resetFields();
                this.nav.push(TabsNavigationPage);
            }
        )
    }
}