FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build
WORKDIR /src

COPY ["MyMBG/MyMBG.csproj", "MyMBG/"]
RUN dotnet restore "MyMBG/MyMBG.csproj"

COPY . .
WORKDIR /src/MyMBG
RUN dotnet publish "MyMBG.csproj" \
    --configuration Release \
    --output /app/publish \
    --no-restore \
    /p:UseAppHost=false

FROM mcr.microsoft.com/dotnet/aspnet:10.0 AS runtime
WORKDIR /app

RUN apt-get update \
    && apt-get install --yes --no-install-recommends curl postgresql-client \
    && rm -rf /var/lib/apt/lists/* \
    && (groupadd --system app || true) \
    && (useradd --system --gid app --home-dir /app app || true)

COPY --from=build --chown=app:app /app/publish .
COPY backend-entrypoint.sh /app/entrypoint.sh
RUN chmod 0755 /app/entrypoint.sh && chown app:app /app/entrypoint.sh

ENV ASPNETCORE_ENVIRONMENT=Production \
    ASPNETCORE_URLS=http://+:5292

USER app
EXPOSE 5292

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=5 \
    CMD curl --fail --silent http://127.0.0.1:5292/db/ping || exit 1

ENTRYPOINT ["/app/entrypoint.sh"]
