import socket

import pytest

import card_description_links as links


class Response:
    def __init__(self, status, headers, chunks=()):
        self.status = status
        self.headers = headers
        self.chunks = chunks

    def stream(self, *_args, **_kwargs):
        yield from self.chunks

    def close(self):
        pass


def install_network(monkeypatch, hosts, responses):
    calls = []

    def resolve(host, port, **_kwargs):
        return [(socket.AF_INET, socket.SOCK_STREAM, 0, "", (address, port)) for address in hosts[host]]

    class Pool:
        def __init__(self, address, **kwargs):
            calls.append((address, kwargs))

        def urlopen(self, method, path, **kwargs):
            calls.append((method, path, kwargs))
            return next(responses)

        def close(self):
            pass

    monkeypatch.setattr(links.socket, "getaddrinfo", resolve)
    monkeypatch.setattr(links.urllib3, "HTTPSConnectionPool", Pool)
    return calls


def test_https_pins_the_public_address_and_extracts_readable_content(monkeypatch):
    page = b'<title>Survey</title><nav>menu</nav><p>River &amp; pond observations.</p><script>hidden</script>'
    calls = install_network(monkeypatch, {"atlas.example": ["8.8.8.8"]}, iter([
        Response(200, {"Content-Type": "text/html; charset=utf-8"}, [page]),
    ]))
    assert links.read_link("atlas.example/survey#part") == "Survey\nRiver & pond observations."
    assert calls[0] == ("8.8.8.8", {
        "port": 443, "server_hostname": "atlas.example", "assert_hostname": "atlas.example",
        "cert_reqs": "CERT_REQUIRED",
    })
    method, path, options = calls[1]
    assert (method, path) == ("GET", "/survey")
    assert options["headers"]["Host"] == "atlas.example"
    assert options["redirect"] is False


def test_redirect_checks_destination_before_making_another_request(monkeypatch):
    calls = install_network(monkeypatch, {
        "atlas.example": ["8.8.8.8"], "other.example": ["127.0.0.1"],
    }, iter([Response(302, {"Location": "https://other.example/"})]))
    with pytest.raises(ValueError, match="public site"):
        links.read_link("https://atlas.example/")
    assert len(calls) == 2


def test_link_body_has_a_byte_limit_even_without_content_length(monkeypatch):
    monkeypatch.setattr(links, "MAX_LINK_BYTES", 8)
    install_network(monkeypatch, {"atlas.example": ["8.8.8.8"]}, iter([
        Response(200, {"Content-Type": "text/plain"}, [b"sample", b"survey"]),
    ]))
    with pytest.raises(ValueError, match="size or time limit"):
        links.read_link("https://atlas.example/")
