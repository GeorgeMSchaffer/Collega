# Proxy CA certificates

Drop a `.crt` here and the dev images will trust it.

Behind a TLS-inspecting proxy — a corporate one, or the agent proxy in a Claude
Code remote session — NuGet cannot verify `api.nuget.org` and `dotnet restore`
fails with a certificate error inside the container even though it works on the
host. The host trusts the proxy's CA; a fresh container does not.

```bash
cp /root/.ccr/ca-bundle.crt docker/proxy-ca/proxy.crt   # remote session
docker compose --profile full build api
```

Nothing here is committed except this file: certificates are environment-specific
and `.gitignore` excludes `*.crt`. With no certificate present the `COPY` matches
only this README and `update-ca-certificates` is a no-op, so the build is
unaffected on a machine that needs no proxy.
