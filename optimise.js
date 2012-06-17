// optimise.js
// written quickly by jeremy (jeremyherbert.net)
// CC 3.0 License: http://creativecommons.org/licenses/by-nc-sa/3.0/

// table of Exx values
E_table = {
    E3:  [1.0, 2.2, 4.7]
};
E_table.E6 = E_table.E3.concat([1.5, 3.3, 6.8]).sort();
E_table.E12 = E_table.E6.concat([1.2, 1.6, 1.8, 2.2, 2.7, 3.9, 4.7, 5.6, 8.2]).sort();
E_table.E24 = E_table.E12.concat([1.1, 1.3, 2.0, 2.4, 3, 3.3, 3.6, 4.3, 5.1, 5.6, 6.2, 7.5, 9.1]).sort();

parameters = {
    num_args: 3,
    equation: '',
    desired: 0,
    algo: 'force',
    args: {}
};

SI = {
    "15": 'P',
    "12": 'T',
    "9": 'G',
    "6": 'M',
    "3": 'k',
    "-3": 'm',
    "-6": 'u',
    "-9": 'n',
    "-12": 'p',
    "-15": 'f'
}

steepest_passes = 25;

/**********************************************/

// get around the log precision errors in js
function get_decade(val) {
    with (Math) {
        var decade = floor(log(val)/LN10);

        if (pow(10, decade) <= val && pow(10, decade+1) > val) {
            return decade;
        } else if (pow(10, decade) > val) {
            return decade-1;
        } else {
            return decade+1;
        }
    }
}

// more precision error defeating, raargh
function round_to_two_sig_figs(val) {
    var decade = get_decade(val);
    if (decade != 1) {
        var temp = val / Math.pow(10, decade-1);
        temp = Math.round(temp).toString();
        
        var i=0;
        if (decade > 1) {
            for (i=15; i>0; i-=3) {
                if (decade/i >= 1) {
                    break;
                }
            }
        } else {
            for (i=0; i>-16; i-=3) {
                if (i <= decade) {
                    break;
                }
            }
        }
        
        var suffix = SI[i.toString()];
        decade -= i;
        
        for (i=0; i<decade-1; i++) temp += 0;
        if (decade == 0) temp = temp[0] + '.' + temp.substr(1);
        
        if (suffix != undefined) {
            return temp+suffix;
        }
        return temp;
    } else {
        var temp = val;
        temp = Math.round(temp);
        return temp;
    }
}

// interpolate a value into an array, always in the forward direction
function decade_interp_forward(val, arr) {
    with (Math) {
        var decade = get_decade(val);
        var val_scaled = val/pow(10, decade);
        
        var best = -1;
        if (val_scaled > arr[arr.length-1]) {
            return [0, decade];
            
        } else {
            for (i=0; i<arr.length; i++) {
                if (val_scaled <= arr[i]) break
            }
            return [i, decade];
        }
    }
}

// generate all of the values in table across every decade
function decade_generate_values(min, max, table) {
    var val = min;
    
    var interp = decade_interp_forward(val, table);
    var index = interp[0];
    var decade = interp[1];
    
    var val = table[index] * Math.pow(10, decade);
    var out = []
    while (val < max) {
        out.push(val);
        
        index++;
        if (index % table.length == 0) {
            index = 0;
            decade++;
        };
        val = table[index] * Math.pow(10, decade)
    }
    return out;
}

// get the values at the location in the argument space
function get_values_at_loc(loc, args) {
    var out = [];
    for (i=0; i<args.length; i++) {
        out.push(args.values[loc[i]]);
    }
    return out;
}

// does the equation replace
function generate_equation_at_loc(eq_in, loc, args) {
    var eq = eq_in.slice(0);
    $.each(args, function(i,e) {
        eq = eq.replace(e.variable, e.values[loc[i]]);
    });
    return eq;
}

// evaluates a particular coordinate in the argument space
function eval_at_loc(eq_in, loc, args) {
    with (Math) {
        return eval(generate_equation_at_loc(eq_in, loc, args))
    }
}

/**********************************************/

// print some jazz, yo
function output_result(best, best_args, args) {
    $("#output").append($("<p>well, it wasn't easy, but I got your answer. i'll leave you to deal with the mess.<p>"));
    
    var output = 'result: ' + best + '<br />';

    $.each(args, function(i,e) {
        output += e.variable + " = " + round_to_two_sig_figs(e.values[best_args[i]]) + "<br />"
    });
    
    $("#output").append($("<code>" + output + "</code>"));
}

/**********************************************/

// bounded rolling counter
function inc_location(loc, args) {
    if (loc[args.length-1] >= args[args.length-1].values.length) return -1;
    
    loc[0]++;
    for (i=0; i<args.length-1; i++) {
        if (loc[i] > args[i].values.length) {
            loc[i] = 0;
            loc[i+1]++;
        }
    }
    
    if (loc[args.length-1] > args[args.length-1].values.length) return -1;
    return 0;
}

// leave no stone unturned
function brute_force(param) {
    var loc = [];
    for (i=0; i<param.num_args; i++) loc.push(0);
    
    var equation = param.equation;
    var args = param.args;
    
    var best = 1E100;
    var best_result = 0;
    var best_args = [];
    var result = 0;
    
    do {
        result = eval_at_loc(equation, loc, args)
        
        val = param.desired - result;
        val *= val; // fast square
        if (val < best) {
            best = val;
            best_result = result;
            best_args = loc.slice(0); // deep copy
        }
    } while (inc_location(loc, args) == 0);
    
    output_result(best_result, best_args, args);
}

/**********************************************/

function generate_neighbour_tree(n, val) {
    if (n == 0) {
        return {val: val, children: null};
    }
    
    return {
        val: val,
        children: [
            generate_neighbour_tree(n-1, -1),
            generate_neighbour_tree(n-1, 0),
            generate_neighbour_tree(n-1, 1)
        ]
    };
}

function get_neighbour_tree(n) {
    return generate_neighbour_tree(n, null);
}

function walk_neighbour_tree(t, outp_in, perms) {
    var output = outp_in.slice(0);
    if (t.children == null) {
        output.push(t.val);
        perms.push(output);
        return;
    }
    
    if (t.val != null) {
        output.push(t.val);
    } 
    
    $.each(t.children, function (i,e) {
        walk_neighbour_tree(e, output, perms);
    });
    return perms
}

function elementwise_add (a, b) {
    if (a.length != b.length) {
        console.log("length mismatch");
        return;
    }
    var out = [];
    $.each(a, function(i, e) {
        out.push(a[i] + b[i]);
    });
    return out;
}

function inside_bounds(loc, args) {
    $.each(loc, function (i,e) {
        if (loc[i] > args[i].values.length-1 || loc[i] < 0) return false;
    });
    return true;
}

// steepest descent
function steepest_descent(param) {
    var args = param.args;
    
    neighbour_perms = walk_neighbour_tree(get_neighbour_tree(args.length), [], []);
    
    var pass_best = 1E100;
    var pass_best_result = 0;
    var pass_best_args = [];
    
    for (i=0; i<steepest_passes; i++) {
        var best = 1E100;
        var best_result = 0;
        var best_args = [];
        
        // pick a random location
        var loc = [];
        $.each(args, function (i,e) {
            loc.push(Math.round(Math.random() * e.values.length));
        });

        var equation = param.equation.slice(0);

        var local_min = 1E100;
        var local_min_result = 0;
        var local_min_loc = [0,0,0];

        var val;
        var new_loc;
        while (1) {

            // examine all of the neighbours for the best
            $.each(neighbour_perms, function(i,e) {

                new_loc = elementwise_add(loc, e);
                if (inside_bounds(new_loc, args)) {
                    result = eval_at_loc(equation, new_loc, args);
                    
                    val = param.desired - result;
                    val *= val;

                    if (val < local_min) {
                        local_min = val;
                        local_min_result = result;
                        local_min_loc = new_loc.slice(0);
                    }
                }
            });
            
            if (local_min < best) {
                best = local_min;
                best_result = local_min_result;
                best_args = local_min_loc.slice(0);
                loc = local_min_loc.slice(0);
            } else {
                break;
            }
        }

        if (best < pass_best) {
            pass_best = best;
            pass_best_result = best_result;
            pass_best_args = best_args;
        }
    }
    
    output_result(pass_best_result, pass_best_args, args);
}

/**********************************************/

type_options = ['E24', 'E12', 'E6', 'E3'];
var_count = 0;

function update_params() {
    parameters.num_args = $('#num_args').val();
    steepest_passes = parameters.num_args*25;
    parameters.equation = $('#equation').val();
    parameters.desired = $("#desired").val();
    parameters.algo = $('input[name=algo_radio]:checked').val();
    
    parameters.args = [];
    $.each($('tr[id^=var]'), function(i, e) {
        id = e.id
        variable = $("#" + id + "-variable").val();
        if (variable) {
            parameters.args.push({
                variable: variable,
                var_type: $("#" + id + "-type").val(),
                min: $('#' + id + "-min").val(),
                max: $('#' + id + "-max").val()
            });
        }
    });
}

function gen_row(n) {
    var tr = $('<tr id="var' + n + '">');
    tr.append($('<td><input type="text" id="var' + n + '-variable" value=""></input></td>'));

    var select = $('<select id="var' + n + '-type">');
    $.each(type_options, function (e) {
        select.append($('<option value=' + type_options[e] + '>' + type_options[e] + '</option>')); 
    });
    tr.append(select);

    tr.append($('<td><input type="number" id="var' + n + '-min" value=1 min=1E-15 max=1E15></input></td>'));
    tr.append($('<td><input type="number" id="var' + n + '-max" value=1E6 min=1E-15 max=1E15></input></td>'));

    return tr;
}

function gen_selectors() {
    update_params();
    while (var_count != parameters.num_args) {
        if (var_count > parameters.num_args) {
            $('tr[id^=var]').last().remove();
            var_count--;
        } else {
            $('#arg_table').append(gen_row($('tr[id^=var]').length));
            var_count++;
        }
    }
}

$(document).ready(function() {
    gen_selectors();
    $('#var0-variable').val('R');
    
    $('#var1-variable').val('C');
    $('#var1-type').val('E6');
    $('#var1-min').val('1E-12');
    $('#var1-max').val('1E-3');
    
    $('#num_args').change(function () {
        e = $('#num_args');
        if (e.val() < 1 || e.val() > 99) e.val(parameters.num_args);
        gen_selectors();
    });
    
    $('#run').click(function () {
        update_params();
        
        // generate the variable values
        $.each(parameters.args, function(i,e) {
            e.values = decade_generate_values(e.min, e.max, E_table[e.var_type]);
        });
        
        $("#output").empty();
        $('#output').append($("<p>stand back and let me do my thing...</p>"));
        
        if (parameters.algo == 'steepest') steepest_descent(parameters);
        else brute_force(parameters);
    });
});