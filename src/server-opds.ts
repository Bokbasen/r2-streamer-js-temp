import * as debug_ from "debug";
import * as path from "path";
// import * as querystring from "querystring";
// import * as util from "util";

import * as express from "express";
import * as morgan from "morgan";
import * as request from "request";
import * as xmldom from "xmldom";

import { OPDS } from "./parser/opds/opds";
import { Entry } from "./parser/opds/opds-entry";
import { streamToBufferPromise } from "./parser/zip";
import { Server } from "./server";
import { trailingSlashRedirect } from "./server-trailing-slash-redirect";
import { encodeURIComponent_RFC3986 } from "./utils";
import { XML } from "./xml-js-mapper";

const debug = debug_("r2:server:opds");

function ensureAbsolute(rootUrl: string, linkHref: string) {
    let url = linkHref;
    if (url.indexOf("http") !== 0 && url.indexOf("data:") !== 0) {

        if (url.indexOf("//") === 0) {
            if (rootUrl.indexOf("https://") === 0) {
                url = "https:" + url;
            } else {
                url = "http:" + url;
            }
        } else if (url[0] === "/") {
            const j = rootUrl.replace(/:\/\//g, ":__").indexOf("/");
            const rootUrlOrigin = rootUrl.substr(0, j);
            url = path.join(rootUrlOrigin, url);

            url = url.replace(/\\/g, "/").replace(/^http[s]?:\//g, "http:\/\/");
        } else {
            const i = rootUrl.indexOf("?");
            let rootUrlWithoutQuery = rootUrl;
            if (i >= 0) {
                rootUrlWithoutQuery = rootUrlWithoutQuery.substr(0, i);
            }

            if (rootUrlWithoutQuery.substr(-1) === "/") {
                url = path.join(rootUrlWithoutQuery, url);
            } else {
                url = path.join(path.dirname(rootUrlWithoutQuery), url);
            }

            url = url.replace(/\\/g, "/").replace(/^http[s]?:\//g, "http:\/\/");
        }
    }
    return url;
}

export function serverOPDS(_server: Server, topRouter: express.Router) {

    const routerUrl = express.Router({ strict: false });
    routerUrl.use(morgan("combined"));

    routerUrl.use(trailingSlashRedirect);

    routerUrl.get("", (_req: express.Request, res: express.Response) => {

        let html = "<html><head>";
        html += `<script type="text/javascript">function encodeURIComponent_RFC3986(str) { ` +
            `return encodeURIComponent(str).replace(/[!'()*]/g, (c) => { ` +
            `return "%" + c.charCodeAt(0).toString(16); }); }` +
            `function go(evt) {` +
            `if (evt) { evt.preventDefault(); } var url = ` +
            `location.origin +` +
            // `location.protocol + '//' + location.hostname + ` +
            // `(location.port ? (':' + location.port) : '') + ` +
            ` '/opds/' +` +
            ` encodeURIComponent_RFC3986(document.getElementById("url").value);` +
            `location.href = url;}</script>`;
        html += "</head>";

        html += "<body><h1>Publication OPDS</h1>";

        html += `<form onsubmit="go();return false;">` +
            `<input type="text" name="url" id="url" size="80">` +
            `<input type="submit" value="Go!"></form>`;

        html += "</body></html>";

        res.status(200).send(html);
    });

    routerUrl.param("urlEncoded", (req, _res, next, value, _name) => {
        (req as any).urlEncoded = value;
        next();
    });

    routerUrl.get("/:urlEncoded(*)", (req: express.Request, res: express.Response) => {

        if (!req.params.urlEncoded) {
            req.params.urlEncoded = (req as any).urlEncoded;
        }

        const urlDecoded = req.params.urlEncoded;
        // if (urlDecoded.substr(-1) === "/") {
        //     urlDecoded = urlDecoded.substr(0, urlDecoded.length - 1);
        // }
        debug(urlDecoded);

        request.get({
            headers: {},
            method: "GET",
            uri: urlDecoded,
        }).
            on("response", async (response: request.RequestResponse) => {

                const responseData = await streamToBufferPromise(response);
                const responseStr = responseData.toString("utf8");
                const responseXml = new xmldom.DOMParser().parseFromString(responseStr);
                // debug(responseXml);
                const isEntry = responseXml.documentElement.localName === "entry";
                let opds: OPDS | undefined;
                let opdsEntry: Entry | undefined;
                if (isEntry) {
                    opdsEntry = XML.deserialize<Entry>(responseXml, Entry);
                } else {
                    opds = XML.deserialize<OPDS>(responseXml, OPDS);
                }

                // // breakLength: 100  maxArrayLength: undefined
                // console.log(util.inspect(opds,
                //     { showHidden: false, depth: 1000, colors: true, customInspect: true }));

                let html = "<html><head>";
                html += "</head>";
                html += "<body><h1>" + urlDecoded + "</h1>";
                if (opds && opds.Title) {
                    html += "<h2>" + opds.Title + "</h2>";
                }
                if (opdsEntry && opdsEntry.Title) {
                    html += "<h2>" + opdsEntry.Title + "</h2>";
                }
                if (opds && opds.Icon) {
                    const iconUrl = ensureAbsolute(urlDecoded, opds.Icon);
                    html += "<img src='" + iconUrl + "' alt='' />";
                }
                // if (opds.Updated) {
                //     html += "<h3>" + opds.Updated.toUTCString() + "</h3>";
                //     html += "<h3>" + opds.Updated.toDateString() + "</h3>";
                //     html += "<h3>" + opds.Updated.toISOString() + "</h3>";
                //     html += "<h3>" + opds.Updated.toTimeString() + "</h3>";
                // }
                const links = opds ? opds.Links : (opdsEntry ? opdsEntry.Links : undefined);
                if (links && links.length) {
                    html += "<p>";
                    links.forEach((link) => {
                        if (link.Type &&
                            (link.Type.indexOf("opds-catalog") >= 0 || link.Type === "application/atom+xml")) {
                            const linkUrl = ensureAbsolute(urlDecoded, link.Href);
                            const opdsUrl = req.originalUrl.substr(0, req.originalUrl.indexOf("/opds/"))
                                + "/opds/" + encodeURIComponent_RFC3986(linkUrl);

                            html += "<a href='" + opdsUrl
                                + "'>" + link.Href + "</a> (TITLE: " + link.Title
                                + ") [REL: " + link.Rel + "]<br/>";
                        }
                    });
                    html += "</p>";
                }

                function processEntry(entry: Entry) {

                    html += "<hr/>";
                    html += "<div>";
                    if (opds) {
                        html += "<h3>" + entry.Title + "</h3>";
                    }
                    if (entry.Summary) {
                        if (!entry.SummaryType || entry.SummaryType === "text") {
                            html += "<strong>" + entry.Summary + "</strong>";
                        } else if (entry.SummaryType === "html") {
                            html += "<div>" + entry.Summary + "</div>";
                        }
                        html += "<br/>";
                    }
                    if (entry.Content) {
                        if (!entry.ContentType || entry.ContentType === "text") {
                            html += "<strong>" + entry.Content + "</strong>";
                        } else if (entry.ContentType === "html") {
                            html += "<div>" + entry.Content + "</div>";
                        }
                        html += "<br/>";
                    }
                    if (entry.Links && entry.Links.length) {
                        let image: string | undefined;
                        let imageThumbnail: string | undefined;
                        let epub: string | undefined;
                        entry.Links.forEach((link) => {
                            if (link.Type === "application/epub+zip") {
                                epub = link.Href;
                            }
                            if (link.Rel === "http://opds-spec.org/image"
                                || link.Rel === "x-stanza-cover-image") {
                                image = link.Href;
                            }
                            if (link.Rel === "http://opds-spec.org/image/thumbnail"
                                || link.Rel === "http://opds-spec.org/thumbnail"
                                || link.Rel === "x-stanza-cover-image-thumbnail") {
                                imageThumbnail = link.Href;
                            }

                            if (opds && link.Type &&
                                (link.Type.indexOf("opds-catalog") >= 0 || link.Type === "application/atom+xml")) {
                                const linkUrl = ensureAbsolute(urlDecoded, link.Href);
                                const opdsUrl = req.originalUrl.substr(0, req.originalUrl.indexOf("/opds/"))
                                    + "/opds/" + encodeURIComponent_RFC3986(linkUrl);

                                html += "<a href='" + opdsUrl
                                    + "'>" + link.Href + "</a> (TITLE: " + link.Title
                                    + ") [REL: " + link.Rel + "]<br/>";
                            }
                        });
                        if (imageThumbnail) {
                            const imageThumbnailUrl = ensureAbsolute(urlDecoded, imageThumbnail);
                            if (image) {
                                const imageUrl = ensureAbsolute(urlDecoded, image);
                                html += "<a href='" + imageUrl + "'><img src='"
                                    + imageThumbnailUrl + "' alt='' /></a><br/>";
                            } else {
                                html += "<img src='" + imageThumbnailUrl + "' alt='' /><br/>";
                            }
                        } else if (image) {
                            const imageUrl = ensureAbsolute(urlDecoded, image);
                            html += "<img src='" + imageUrl + "' alt='' /><br/>";
                        }
                        if (epub) {
                            const epub_ = ensureAbsolute(urlDecoded, epub);
                            const epubUrl = req.originalUrl.substr(0, req.originalUrl.indexOf("/opds/"))
                                + "/url/" + encodeURIComponent_RFC3986(epub_);

                            html += "<strong><a href='" + epubUrl + "'>" + epub + "</a></strong>";
                        }
                    }
                    html += "</div>";
                }

                if (opds && opds.Entries && opds.Entries.length) {
                    opds.Entries.forEach((entry) => {
                        processEntry(entry);
                    });
                }
                if (opdsEntry) {
                    processEntry(opdsEntry);
                }

                html += "</body></html>";

                res.status(200).send(html);
            }).
            on("error", (err: any) => {
                debug(err);
                res.status(500).send("<html><body><p>Internal Server Error</p><p>"
                    + err + "</p></body></html>");
            });
    });

    topRouter.use("/opds", routerUrl);
}
