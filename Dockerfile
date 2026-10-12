FROM mcr.microsoft.com/dotnet/sdk:8.0 AS build
WORKDIR /src

COPY Ledger.sln ./
COPY src/Ledger.Api/Ledger.Api.csproj src/Ledger.Api/
COPY tests/Ledger.Tests/Ledger.Tests.csproj tests/Ledger.Tests/
RUN dotnet restore Ledger.sln

COPY . .
RUN dotnet publish src/Ledger.Api/Ledger.Api.csproj \
    --configuration Release \
    --no-restore \
    --output /app/publish

FROM mcr.microsoft.com/dotnet/aspnet:8.0 AS final
WORKDIR /app

COPY --from=build /app/publish .
ENV ASPNETCORE_HTTP_PORTS=8080
EXPOSE 8080

ENTRYPOINT ["dotnet", "Ledger.Api.dll"]