import { JSON } from "ta-json";

import { IStringMap } from "./models/metadata-multilang";

import { MediaOverlayNode } from "./models/media-overlay";
import { Metadata } from "./models/metadata";

let args = process.argv.slice(2);

interface IStringKeyedObject { [key: string]: any; }

function sortObject(obj: any): any {
    if (obj instanceof Array) {
        for (let i = 0; i < obj.length; i++) {
            obj[i] = sortObject(obj[i]);
        }
        return obj;
    } else if (typeof obj !== "object") {
        return obj;
    }

    let newObj: IStringKeyedObject = {};

    Object.keys(obj).sort().map((key) => {
        newObj[key] = sortObject(obj[key]);
    });

    return newObj;
}

console.log("~~~~~~~~~~~~~~~");

let meta1 = new Metadata();
meta1.RDFType = "test single";
meta1.Title = "title OK";

let meta1JsonObj = JSON.serialize(meta1);
let meta1JsonStr = JSON.stringify(sortObject(meta1JsonObj));
console.log(meta1JsonStr);

let meta1Reversed = JSON.deserialize<Metadata>(meta1JsonObj, Metadata);
console.log(meta1Reversed);

console.log("===============");

let meta2 = new Metadata();
meta2.RDFType = "test multiple";
meta2.Title = {} as IStringMap;
meta2.Title["fr-FR"] = "title FR";
meta2.Title["en-US"] = "title EN";

let meta2JsonObj = JSON.serialize(meta2);
let meta2JsonStr = JSON.stringify(sortObject(meta2JsonObj));
console.log(meta2JsonStr);

let meta2Reversed = JSON.deserialize<Metadata>(meta2JsonObj, Metadata);
console.log(meta2Reversed);

console.log("===============");
console.log("===============");

// let mo1 = new MediaOverlayNode();

// mo1.Audio = "test.mp3";

// mo1.Role = Array<string>(2);
// mo1.Role[0] = "role1";
// mo1.Role.push("role3");
// mo1.Role[1] = "role2";
// mo1.Role.push("role4");

// let mo2 = new MediaOverlayNode();
// mo2.Text = "Tz";

// mo1.Children = Array<MediaOverlayNode>();
// mo1.Children.push(mo2);

// let json = JSON.serialize(mo1);
// console.log(json);

// let jsonString = global.JSON.stringify(json);
// console.log(jsonString);

// let jsonObject = global.JSON.parse(jsonString);
// console.log(jsonObject);

// console.log("---------------");

// let mo4 = JSON.deserialize<MediaOverlayNode>(json, MediaOverlayNode, { runConstructor: true });
// console.log(mo4 instanceof MediaOverlayNode);
// console.log(mo4);
// // console.log(mo4.info);

// console.log("~~~~~~~~~~~~~~~");

// // let jsonStr = JSON.stringify(mo1);
// // console.log(jsonStr);

// // console.log("---------------");

// // let mo3 = JSON.parse<MediaOverlayNode>(jsonStr, MediaOverlayNode, { runConstructor: true });
// // console.log(mo3 instanceof MediaOverlayNode);
// // console.log(mo3);
// // // console.log(mo3.info);

// // console.log("---------------");
