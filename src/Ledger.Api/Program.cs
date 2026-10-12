using Ledger.Api.Data;
using Microsoft.EntityFrameworkCore;
using Ledger.Api.Endpoints;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddDbContext<LedgerDbContext>(options => options.UseNpgsql(builder.Configuration.GetConnectionString("Ledger")));

builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();

var app = builder.Build();

if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}

app.UseHttpsRedirection();

app.MapGet("/health", () => Results.Ok(new
{
    status = "Healthy",
    application = "Ledger"
}))
.WithName("GetHealth")
.WithOpenApi();

app.MapProductEndpoints();

app.Run();

public partial class Program { }