"""Fetch a bounded amount of readable content from a public project link."""

from email.message import Message
from html.parser import HTMLParser
import ipaddress
import socket
import time
from urllib.parse import urljoin, urlsplit

import urllib3

from endpoint_files.card_description_sources import read_document


MAX_LINK_BYTES = 2 * 1024 * 1024
MAX_LINK_CHARS = 12_000
_REDIRECTS = {301, 302, 303, 307, 308}
_IGNORED = {"script", "style", "noscript", "svg", "template", "nav", "footer", "iframe"}
_BREAKS = {"h1", "h2", "h3", "h4", "p", "div", "section", "article", "main", "li", "tr", "br"}


class _PageText(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.parts = []
        self.hidden = []

    def handle_starttag(self, tag, attrs):
        if tag in _IGNORED:
            self.hidden.append(tag)
        elif not self.hidden:
            if tag in _BREAKS:
                self.parts.append("\n")
            if tag == "meta":
                attributes = dict(attrs)
                if (attributes.get("name") or "").lower() == "description" and attributes.get("content"):
                    self.parts.extend(("\n", attributes["content"], "\n"))

    def handle_endtag(self, tag):
        if self.hidden:
            if tag == self.hidden[-1]:
                self.hidden.pop()
        elif tag in _BREAKS or tag == "title":
            self.parts.append("\n")

    def handle_data(self, data):
        if not self.hidden:
            self.parts.append(data)

    def text(self):
        lines = (" ".join(line.split()) for line in "".join(self.parts).splitlines())
        return "\n".join(line for line in lines if line)[:MAX_LINK_CHARS]


def _destination(url):
    if len(url) > 4096 or any(char.isspace() or ord(char) < 32 for char in url) or "\\" in url:
        raise ValueError("Invalid web address.")
    parts = urlsplit(url)
    if parts.scheme not in {"https", "http"} or not parts.hostname or parts.username is not None:
        raise ValueError("Use a public HTTP or HTTPS link.")
    expected_port = 443 if parts.scheme == "https" else 80
    if parts.port not in {None, expected_port}:
        raise ValueError("Use a standard web port.")
    hostname = parts.hostname.encode("idna").decode("ascii").rstrip(".")
    if not hostname or "%" in hostname:
        raise ValueError("Invalid web host.")
    records = socket.getaddrinfo(hostname, expected_port, type=socket.SOCK_STREAM)
    addresses = {ipaddress.ip_address(record[4][0]) for record in records}
    if not addresses or any(
        not address.is_global or address.is_multicast or address.is_reserved
        or (address.version == 6 and (address.ipv4_mapped or address.sixtofour or address.teredo))
        for address in addresses
    ):
        raise ValueError("The link must point to a public site.")
    address = min(addresses, key=lambda ip: (ip.version, int(ip)))
    # Pin the socket to the checked address. Keep the original host for HTTP
    # routing, TLS SNI and certificate verification.
    if parts.scheme == "https":
        pool = urllib3.HTTPSConnectionPool(
            str(address), port=expected_port, server_hostname=hostname,
            assert_hostname=hostname, cert_reqs="CERT_REQUIRED",
        )
    else:
        pool = urllib3.HTTPConnectionPool(str(address), port=expected_port)
    host_header = f"[{hostname}]" if ":" in hostname else hostname
    target = parts.path or "/"
    if parts.query:
        target += f"?{parts.query}"
    if not target.startswith("/") or target.startswith("//"):
        pool.close()
        raise ValueError("Invalid link path.")
    return pool, host_header, target


def _response_text(response, deadline):
    if response.headers.get("Content-Encoding", "").strip().lower() not in {"", "identity"}:
        raise ValueError("The site's response encoding is unsupported.")
    size = response.headers.get("Content-Length")
    if size and int(size) > MAX_LINK_BYTES:
        raise ValueError("The linked page or document is too large.")
    content_type = Message()
    header = response.headers.get("Content-Type", "")
    if not header:
        raise ValueError("The linked response does not identify its content type.")
    content_type["Content-Type"] = header
    mime = content_type.get_content_type()
    if mime not in {"text/html", "application/xhtml+xml", "application/pdf", "application/json"} and not mime.startswith("text/"):
        raise ValueError("The linked page or document type is unsupported.")
    body = bytearray()
    for chunk in response.stream(8192, decode_content=False):
        if len(body) + len(chunk) > MAX_LINK_BYTES or time.monotonic() >= deadline:
            raise ValueError("The linked page could not be read within the size or time limit.")
        body.extend(chunk)
    if mime == "application/pdf":
        return read_document(bytes(body), "linked-document.pdf")
    charset = content_type.get_content_charset("utf-8")
    try:
        page = body.decode(charset, errors="replace")
    except LookupError:
        page = body.decode("utf-8", errors="replace")
    if mime in {"text/html", "application/xhtml+xml"}:
        parser = _PageText()
        parser.feed(page)
        parser.close()
        text = parser.text()
    else:
        text = page.strip()[:MAX_LINK_CHARS]
    if not text:
        raise ValueError("The link contains no readable text.")
    return text


def read_link(url):
    url = url.strip()
    if "://" not in url:
        url = f"https://{url}"
    deadline = time.monotonic() + 8
    try:
        for _ in range(4):
            pool, host, target = _destination(url)
            try:
                remaining = deadline - time.monotonic()
                if remaining <= 0:
                    raise ValueError("The link took too long to respond.")
                response = pool.urlopen(
                    "GET", target, redirect=False, retries=False, preload_content=False,
                    timeout=urllib3.Timeout(total=remaining, connect=2.5, read=2.5),
                    headers={"Host": host, "Accept-Encoding": "identity", "User-Agent": "RWC-Living-Atlas"},
                )
                try:
                    if response.status in _REDIRECTS and response.headers.get("Location"):
                        redirected = urljoin(url, response.headers["Location"])
                        if urlsplit(url).scheme == "https" and urlsplit(redirected).scheme != "https":
                            raise ValueError("The link redirects away from HTTPS.")
                        url = redirected
                        continue
                    if response.status != 200:
                        raise ValueError("The site did not return a readable page.")
                    return _response_text(response, deadline)
                finally:
                    response.close()
            finally:
                pool.close()
    except (OSError, urllib3.exceptions.HTTPError) as error:
        raise ValueError("The site could not be reached.") from error
    raise ValueError("The link has too many redirects.")
