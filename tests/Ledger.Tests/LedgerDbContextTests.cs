
using Ledger.Api.Data;
using Ledger.Api.Models;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Xunit;

namespace Ledger.Api.Tests;

public class LedgerDbContextTests
{
    [Fact]
    public async Task CanPersistIdentityUser()
    {
        var options = new DbContextOptionsBuilder<LedgerDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options;

        await using var db = new LedgerDbContext(options);

        var user = new IdentityUser
        {
            UserName = "owner",
            NormalizedUserName = "OWNER",
            Email = "owner@example.com",
            NormalizedEmail = "OWNER@EXAMPLE.COM"
        };

        db.Users.Add(user);
        await db.SaveChangesAsync();

        var savedUser = await db.Users
            .SingleOrDefaultAsync(u => u.UserName == "owner");

        Assert.NotNull(savedUser);
        Assert.Equal(user.Id, savedUser.Id);
    }

    [Fact]
    public void ModelIncludesIdentityAndProductEntities()
    {
        var options = new DbContextOptionsBuilder<LedgerDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options;

        using var db = new LedgerDbContext(options);

        Assert.NotNull(db.Model.FindEntityType(typeof(IdentityUser)));
        Assert.NotNull(db.Model.FindEntityType(typeof(Product)));
    }
}
